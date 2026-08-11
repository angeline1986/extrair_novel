import fs from 'fs-extra';
import path from 'path';
import pdfParse from 'pdf-parse';
import { normalizeLineBreaks, normalizeWhiteSpace } from '../utils/text-utils.js';

export async function readPdfFile(pdfPath) {
  const buffer = await fs.readFile(pdfPath);
  const parsed = await pdfParse(buffer);

  const rawText = normalizeLineBreaks(parsed.text || '');
  const pages = splitIntoPages(rawText);

  const metadata = parsed.info || {};
  const title = metadata.Title || path.basename(pdfPath, '.pdf');
  const language = inferLanguage(metadata.Language || 'pt-BR');

  return {
    filePath: pdfPath,
    fileName: path.basename(pdfPath),
    title,
    language,
    pageCount: pages.length || parsed.numpages || 0,
    textLength: rawText.length,
    metadata,
    pages,
    rawText,
  };
}

function splitIntoPages(rawText) {
  const normalized = normalizeWhiteSpace(rawText);
  const separated = normalized.split(/\f|\n\s*\n\s*\n\s*\n/);

  return separated
    .map((page, index) => ({
      index: index + 1,
      text: normalizeWhiteSpace(page),
    }))
    .filter((page) => page.text.length > 0);
}

function inferLanguage(value) {
  if (!value) return 'pt-BR';
  return String(value).trim();
}
