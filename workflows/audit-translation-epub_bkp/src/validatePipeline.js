#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import AdmZip from 'adm-zip';
import {
  actionId,
  candidateId,
  CorrectionMode,
  CorrectionRisk,
  CorrectionStatus,
} from './correction/correctionTypes.js';
import {
  buildCorrectionCandidates,
  buildCorrectionPlan,
} from './correction/correctionPlanner.js';
import { buildXhtmlMap } from './xhtmlMapper.js';
import { applySafeCorrectionsToZip } from './correction/xhtmlCorrectionEngine.js';
import { validatePostCorrection } from './correction/postCorrectionValidator.js';
import { validateReviewQueue } from './correction/reviewQueueValidator.js';
import {
  alignedOriginalParagraphByText,
  buildChapterAlignment,
} from './chapterAligner.js';

function writeFixtureEpub(filePath, bodyText) {
  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`));
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Fixture</dc:title></metadata>
  <manifest><item id="c1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c1"/></spine>
</package>`));
  zip.addFile('OEBPS/Text/chapter1.xhtml', Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 1</title></head>
  <body>
    <h1>Chapter 1</h1>
    <p>${bodyText}</p>
    <p>Ayra and Janus found 3 mana stones!</p>
  </body>
</html>`));
  zip.writeZip(filePath);
}

function readZip(filePath) {
  return new AdmZip(filePath);
}

function testCorrectionTypes() {
  assert.equal(CorrectionMode.AUTO_SAFE, 'auto_safe');
  assert.equal(CorrectionRisk.LOW, 'low');
  assert.equal(CorrectionStatus.PENDING, 'pending');
  assert.equal(candidateId(0), 'cand-0001');
  assert.equal(actionId(2), 'cp-0003');
}

function testXhtmlMapper(epubPath) {
  const map = buildXhtmlMap(epubPath);
  assert.equal(map.stats.spineItems, 1);
  assert.ok(map.stats.paragraphs >= 2);
  assert.ok(map.textNodes.some((node) => node.text.includes('mana stones')));
  return map;
}

function testCorrectionPlanner({ workflowRoot, epubPath, xhtmlMap }) {
  const translationDoc = {
    filePath: epubPath,
    rawText: 'The party found mana stones. Ayra and Janus found 3 mana stones!',
  };
  const sourceDoc = {
    filePath: epubPath,
  };
  const logInfo = {
    filePath: path.join(workflowRoot, 'Log_Traducao.txt'),
    replacements: [{ from: 'mana stones', to: 'pedras de mana' }],
  };
  const candidates = buildCorrectionCandidates({
    logInfo,
    translationDoc,
    xhtmlMap,
    glossary: { terms: { terms: [] }, entities: { entities: [] } },
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].mode, CorrectionMode.AUTO_SAFE);

  const plan = buildCorrectionPlan({
    workflowRoot,
    sourceDoc,
    translationDoc,
    logInfo,
    candidates,
    createdAt: '2026-05-25T00:00:00Z',
  });
  assert.equal(plan.summary.autoSafe, 1);
  assert.equal(plan.actions[0].before, 'mana stones');
  return plan;
}

function testXhtmlCorrectionEngine({ epubPath, correctionPlan, correctedPath }) {
  const zip = readZip(epubPath);
  const result = applySafeCorrectionsToZip(zip, correctionPlan);
  assert.equal(result.summary.appliedCorrections, 2);
  assert.equal(result.summary.replacements, 2);
  assert.equal(result.skippedActions.length, 0);
  zip.writeZip(correctedPath);
  return result;
}

function testPostCorrectionValidator({ translatedPath, correctedPath, correctionResult, outputPath }) {
  const report = validatePostCorrection({
    translatedPath,
    correctedPath,
    correctionResult,
    correctionReportPath: path.join(path.dirname(outputPath), 'correction-report.json'),
    outputPath,
    timestamp: '2026-05-25T00:00:00Z',
  });
  assert.equal(report.packageValidation.zipReadable, true);
  assert.equal(report.packageValidation.manifestValid, true);
  assert.equal(report.packageValidation.spineValid, true);
  assert.equal(report.textComparison.textChanged, true);
  assert.equal(report.correctionValidation.confirmedCorrections, 2);
}

function testReviewQueueValidator() {
  const invalid = validateReviewQueue({
    items: [{
      id: 'rq-0001',
      status: 'approved',
      before: null,
      after: null,
      filePath: 'OEBPS/Text/chapter1.xhtml',
      nodeId: 's0000-p0001-t0000',
    }],
  });
  assert.equal(invalid.ok, false);

  const valid = validateReviewQueue({
    items: [{
      id: 'rq-0002',
      status: 'approved',
      before: 'Ele viu',
      after: 'Ela viu',
      filePath: 'OEBPS/Text/chapter1.xhtml',
      nodeId: 's0000-p0001-t0000',
      paragraphIndex: 1,
      textNodeIndex: 0,
    }],
  });
  assert.equal(valid.ok, true);
}

function testChapterAligner() {
  const sourceDoc = {
    sections: [{
      index: 0,
      title: 'Chapter 1',
      path: 'OEBPS/Text/chapter1.xhtml',
      paragraphs: [
        'Ayra and Janus found 3 mana stones!',
        'A completely unrelated sentence.',
      ],
      rawText: 'Ayra and Janus found 3 mana stones!',
    }],
  };
  const translationDoc = {
    sections: [{
      index: 0,
      title: 'Capítulo 1',
      path: 'OEBPS/Text/chapter1.xhtml',
      paragraphs: ['Ayra e Janus encontraram 3 pedras de mana!'],
    }],
  };
  const alignment = buildChapterAlignment(sourceDoc, translationDoc);
  assert.equal(alignment.stats.reliableMatches, 1);

  const paragraph = alignedOriginalParagraphByText({
    sourceDoc,
    chapterAlignment: alignment,
    translationPath: 'OEBPS/Text/chapter1.xhtml',
    paragraphIndex: 0,
    translatedParagraph: 'Ayra e Janus encontraram 3 pedras de mana!',
  });
  assert.ok(paragraph.paragraphAlignmentConfidence >= 0.72);
  assert.equal(paragraph.text, 'Ayra and Janus found 3 mana stones!');
}

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-pipeline-'));
  const translatedPath = path.join(tempDir, 'translated.epub');
  const correctedPath = path.join(tempDir, 'corrected.epub');
  const validationPath = path.join(tempDir, 'post-correction-validation.json');

  writeFixtureEpub(translatedPath, 'The party found mana stones.');

  testCorrectionTypes();
  const xhtmlMap = testXhtmlMapper(translatedPath);
  const plan = testCorrectionPlanner({ workflowRoot: tempDir, epubPath: translatedPath, xhtmlMap });
  const correctionResult = testXhtmlCorrectionEngine({
    epubPath: translatedPath,
    correctionPlan: plan,
    correctedPath,
  });
  testPostCorrectionValidator({
    translatedPath,
    correctedPath,
    correctionResult,
    outputPath: validationPath,
  });
  testReviewQueueValidator();
  testChapterAligner();

  console.log('EPUB pipeline validation OK');
  console.log(`Fixture dir: ${tempDir}`);
}

run();
