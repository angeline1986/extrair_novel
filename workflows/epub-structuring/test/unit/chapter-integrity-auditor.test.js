import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { writeZipFile } from '../../src/utils/zip-writer.js';
import { buildReferenceDocument } from '../../src/features/reference/reference-document.js';
import { auditChapterIntegrity } from '../../src/features/reference/chapter-integrity-auditor.js';
import { loadReferenceSource } from '../../src/features/reference/reference-loader.js';
import { chaptersFromPlainText } from '../../src/features/reference/adapters/pdf-reference-adapter.js';

test('chapter integrity auditor supports structural-only mode without reference', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-structural-'));
  const epub = path.join(dir, 'target.epub');
  createTargetEpub(epub, [
    chapter(1, 'Capítulo 1: Um', 'inicio um meio fim um'),
    chapter(2, 'Capítulo 2: Dois', 'inicio dois meio fim dois')
  ]);

  const report = auditChapterIntegrity(epub);
  assert.equal(report.status, 'OK_WITH_WARNINGS');
  assert.equal(report.reference, null);
  assert.equal(report.chapterCount, 2);
  assert.ok(report.warnings.some((warning) => warning.code === 'NO_REFERENCE_SOURCE'));
});

test('chapter integrity auditor accepts matching reference chapters', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-ok-'));
  const epub = path.join(dir, 'target.epub');
  createTargetEpub(epub, [
    chapter(1, 'Capítulo 1: Um', 'alpha começo meio omega'),
    chapter(2, 'Capítulo 2: Dois', 'bravo começo meio zulu')
  ]);

  const referenceDocument = makeReference([
    refChapter(1, 'Capítulo 1: Um', 'alpha começo meio omega'),
    refChapter(2, 'Capítulo 2: Dois', 'bravo começo meio zulu')
  ]);
  const report = auditChapterIntegrity(epub, referenceDocument);
  assert.equal(report.status, 'OK');
  assert.equal(report.confidence, 'high');
  assert.deepEqual(report.boundaryIssues, []);
  assert.deepEqual(report.missingContent, []);
});

test('chapter integrity auditor detects boundary leakage between chapters', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-leak-'));
  const epub = path.join(dir, 'target.epub');
  createTargetEpub(epub, [
    chapter(1, 'Capítulo 1: Um', 'alpha começo meio omega bravo começo'),
    chapter(2, 'Capítulo 2: Dois', 'bravo começo meio zulu')
  ]);

  const report = auditChapterIntegrity(epub, makeReference([
    refChapter(1, 'Capítulo 1: Um', 'alpha começo meio omega'),
    refChapter(2, 'Capítulo 2: Dois', 'bravo começo meio zulu')
  ]));
  assert.equal(report.status, 'REVIEW_REQUIRED');
  assert.ok(report.boundaryIssues.some((issue) => issue.code === 'NEXT_CHAPTER_START_IN_PREVIOUS' && issue.chapter === 2));
  assert.ok(report.duplicatedContent.some((issue) => issue.code === 'REFERENCE_START_DUPLICATED'));
});

test('chapter integrity auditor detects missing first and last content signals', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-missing-'));
  const epub = path.join(dir, 'target.epub');
  createTargetEpub(epub, [chapter(1, 'Capítulo 1: Um', 'somente meio')]);

  const report = auditChapterIntegrity(epub, makeReference([
    refChapter(1, 'Capítulo 1: Um', 'alpha começo meio omega')
  ]));
  assert.equal(report.status, 'REVIEW_REQUIRED');
  assert.ok(report.missingContent.some((issue) => issue.code === 'FIRST_TEXT_NOT_FOUND'));
  assert.ok(report.missingContent.some((issue) => issue.code === 'LAST_TEXT_NOT_FOUND'));
});

test('reference loader reports DOCX as structured unsupported adapter', async () => {
  const result = await loadReferenceSource('/tmp/referencia.docx');
  assert.equal(result.sourceType, 'docx');
  assert.equal(result.adapterStatus, 'unsupported');
  assert.match(result.error, /DOCX_REFERENCE_ADAPTER_UNAVAILABLE/);
});

test('plain text reference parser supports PDF adapter chapter extraction shape', () => {
  const chapters = chaptersFromPlainText(`Capítulo 1: Um
alpha começo
omega

Capítulo 2 Dois
bravo começo
zulu`);
  assert.deepEqual(chapters.map((item) => item.number), [1, 2]);
  assert.match(chapters[0].text, /alpha começo/);
});

function makeReference(chapters) {
  return buildReferenceDocument({ sourceType: 'epub', sourceFile: 'reference.epub', language: 'pt-BR', title: 'Ref', chapters });
}

function refChapter(number, heading, text) {
  return { number, heading, title: heading, text, confidence: 'high' };
}

function chapter(number, heading, text) {
  return { number, heading, text };
}

function createTargetEpub(filePath, chapters) {
  const manifest = chapters.map((item) => `    <item id="ch${item.number}" href="chapter_${String(item.number).padStart(3, '0')}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((item) => `    <itemref idref="ch${item.number}"/>`).join('\n');
  writeZipFile(filePath, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml()) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opfXml(manifest, spine)) },
    ...chapters.map((item) => ({
      name: `OEBPS/chapter_${String(item.number).padStart(3, '0')}.xhtml`,
      data: Buffer.from(chapterXhtml(item.heading, item.text))
    }))
  ]);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

function opfXml(manifest, spine) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Target</dc:title><dc:language>pt-BR</dc:language></metadata>
  <manifest>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

function chapterXhtml(heading, text) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${heading}</title></head>
<body><h1>${heading}</h1><p>${text}</p></body>
</html>`;
}
