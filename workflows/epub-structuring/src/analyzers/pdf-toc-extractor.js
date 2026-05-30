import path from 'path';
import { readPdfText, normalizePdfLine } from '../utils/pdf-utils.js';
import { findKnownCanonicalBook } from '../config/canonical-chapters.js';

export async function extractPdfCanonicalChapters(pdfPath, epub) {
  if (!pdfPath) return emptyReport();
  const text = await readPdfText(pdfPath);
  const known = findKnownCanonicalBook({ epub, pdfPath, pdfText: text });
  const extracted = parseChapterLines(text);
  const chapters = known?.chapters?.length ? known.chapters : extracted;
  return {
    source: path.basename(pdfPath),
    mapSource: known ? 'known-book-map' : 'pdf-text',
    canonicalBookId: known?.id || null,
    language: known?.language || guessLanguage(chapters),
    chapterCount: chapters.length,
    chapters
  };
}

function parseChapterLines(text) {
  const lines = String(text || '').split('\n').map(normalizePdfLine).filter(Boolean);
  const chapters = [];
  let volume = null;
  for (const line of lines) {
    const vol = line.match(/^Vol(?:umen|ume)?\s+(\d+)/i);
    if (vol) volume = Number(vol[1]);
    const match = line.match(/^(\d{1,3})[.)\- ]+(.{2,80})$/);
    if (!match) continue;
    const title = normalizePdfLine(match[2]).replace(/\.{2,}\s*\d+$/, '').trim();
    if (isBadTitle(title)) continue;
    chapters.push({ volume, chapterNumber: Number(match[1]), title });
  }
  return dedupeByNumber(chapters).sort((a, b) => a.chapterNumber - b.chapterNumber);
}

function dedupeByNumber(chapters) {
  return [...new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter])).values()];
}

function isBadTitle(title) {
  return !title || /^\*+$/.test(title) || /^bsj$/i.test(title) || /converted ebook/i.test(title);
}

function guessLanguage(chapters) {
  return chapters.some((chapter) => /reuni[oó]n|n[aá]useas|introducci[oó]n/i.test(chapter.title)) ? 'es' : null;
}

function emptyReport() {
  return { source: null, mapSource: null, canonicalBookId: null, language: null, chapterCount: 0, chapters: [] };
}
