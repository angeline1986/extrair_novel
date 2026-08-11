import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { readEpubFile } from '../epubReader.js';

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readZipText(zip, filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) return null;
  return entry.getData().toString('utf8');
}

function validatePackage(filePath) {
  const result = {
    zipReadable: false,
    mimetypePresent: false,
    mimetypeFirst: false,
    mimetypeValid: false,
    containerPresent: false,
    opfPresent: false,
    manifestValid: false,
    spineValid: false,
    opfPath: null,
    manifestItems: 0,
    spineItems: 0,
    missingSpineRefs: [],
    errors: [],
  };

  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    result.zipReadable = true;
    result.mimetypePresent = Boolean(zip.getEntry('mimetype'));
    result.mimetypeFirst = entries[0]?.entryName === 'mimetype';
    result.mimetypeValid = readZipText(zip, 'mimetype')?.trim() === 'application/epub+zip';
    result.containerPresent = Boolean(zip.getEntry('META-INF/container.xml'));

    const containerXml = readZipText(zip, 'META-INF/container.xml');
    if (!containerXml) return result;

    const container = cheerio.load(containerXml, { xmlMode: true });
    const opfPath = container('rootfile').attr('full-path')?.replaceAll('\\', '/');
    result.opfPath = opfPath || null;
    result.opfPresent = Boolean(opfPath && zip.getEntry(opfPath));
    if (!result.opfPresent) return result;

    const opfDir = path.dirname(opfPath);
    const opfXml = readZipText(zip, opfPath);
    const opf = cheerio.load(opfXml, { xmlMode: true });
    const manifest = new Map();

    opf('manifest item, opf\\:manifest opf\\:item').each((_, item) => {
      const el = opf(item);
      const id = el.attr('id');
      const href = el.attr('href');
      if (!id || !href) return;
      manifest.set(id, path.normalize(path.join(opfDir, href)).replaceAll('\\', '/'));
    });

    result.manifestItems = manifest.size;
    result.manifestValid = manifest.size > 0;

    opf('spine itemref, opf\\:spine opf\\:itemref').each((_, itemref) => {
      const idref = opf(itemref).attr('idref');
      if (!idref) return;
      result.spineItems += 1;
      const itemPath = manifest.get(idref);
      if (!itemPath || !zip.getEntry(itemPath)) result.missingSpineRefs.push(idref);
    });

    result.spineValid = result.spineItems > 0 && result.missingSpineRefs.length === 0;
  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

function textStats(beforeDoc, afterDoc) {
  const before = normalizeText(beforeDoc.rawText);
  const after = normalizeText(afterDoc.rawText);

  return {
    beforeChars: before.length,
    afterChars: after.length,
    charDelta: after.length - before.length,
    beforeParagraphs: beforeDoc.paragraphCount,
    afterParagraphs: afterDoc.paragraphCount,
    paragraphDelta: afterDoc.paragraphCount - beforeDoc.paragraphCount,
    textChanged: before !== after,
  };
}

function validateAppliedCorrections(finalText, appliedCorrections) {
  const normalizedFinalText = normalizeText(finalText);

  return (appliedCorrections || []).map((correction) => {
    const after = normalizeText(correction.after);
    const confirmed = Boolean(after && normalizedFinalText.includes(after));

    return {
      actionId: correction.actionId,
      candidateId: correction.candidateId,
      type: correction.type,
      filePath: correction.filePath,
      nodeId: correction.nodeId,
      replacements: correction.replacements,
      confirmed,
    };
  });
}

export function validatePostCorrection({
  translatedPath,
  correctedPath,
  correctionResult,
  correctionReportPath,
  outputPath,
  timestamp = new Date().toISOString(),
}) {
  const translatedDoc = readEpubFile(translatedPath);
  const correctedDoc = readEpubFile(correctedPath);
  const packageValidation = validatePackage(correctedPath);
  const textComparison = textStats(translatedDoc, correctedDoc);
  const correctionConfirmations = validateAppliedCorrections(
    correctedDoc.rawText,
    correctionResult.appliedCorrections
  );
  const confirmedCorrections = correctionConfirmations.filter((item) => item.confirmed).length;

  const report = {
    schemaVersion: '1.0',
    timestamp,
    source: {
      translatedPath,
      correctedPath,
      correctionReportPath,
    },
    packageValidation,
    textComparison,
    correctionValidation: {
      appliedCorrections: correctionResult.appliedCorrections.length,
      confirmedCorrections,
      unconfirmedCorrections: correctionConfirmations.length - confirmedCorrections,
      corrections: correctionConfirmations,
    },
    status: (
      packageValidation.zipReadable &&
      packageValidation.mimetypePresent &&
      packageValidation.mimetypeFirst &&
      packageValidation.mimetypeValid &&
      packageValidation.containerPresent &&
      packageValidation.opfPresent &&
      packageValidation.manifestValid &&
      packageValidation.spineValid &&
      (
        correctionResult.appliedCorrections.length === 0 ||
        (textComparison.textChanged && confirmedCorrections === correctionResult.appliedCorrections.length)
      )
    ) ? 'OK' : 'WARN',
  };

  if (outputPath) {
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  return report;
}

