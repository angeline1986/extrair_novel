import path from 'node:path';
import { readPdfText } from '../../../utils/pdf-utils.js';
import { parseChapterHeading } from '../../../utils/chapter-parser.js';
import { cleanText } from '../../../utils/text-utils.js';
import { buildReferenceDocument } from '../reference-document.js';

export async function loadPdfReference(pdfPath) {
  const text = await readPdfText(pdfPath);
  const chapters = chaptersFromPlainText(text);
  return buildReferenceDocument({
    sourceType: 'pdf',
    sourceFile: pdfPath,
    title: path.basename(pdfPath, path.extname(pdfPath)),
    chapters
  });
}

export function chaptersFromPlainText(text) {
  const lines = String(text || '').split(/\n+/).map(cleanText).filter(Boolean);
  const chapters = [];
  let current = null;

  for (const line of lines) {
    const parsed = parseChapterHeading(line);
    if (parsed.matched) {
      if (current) chapters.push({ ...current, text: current.parts.join(' ') });
      current = {
        number: parsed.chapterNumber,
        title: parsed.title,
        heading: parsed.originalText,
        parts: [parsed.originalText],
        sourceLocation: { line },
        confidence: 'medium'
      };
      continue;
    }
    if (current) current.parts.push(line);
  }

  if (current) chapters.push({ ...current, text: current.parts.join(' ') });
  return chapters;
}
