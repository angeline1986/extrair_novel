import path from 'path';
import { readPdfText, normalizePdfLine } from '../utils/pdf-utils.js';
import { findKnownCanonicalBook } from '../config/canonical-chapters.js';

export async function extractPdfCanonicalChapters(pdfPath, epub) {
  if (!pdfPath) return emptyReport();
  const text = await readPdfText(pdfPath);
  const known = findKnownCanonicalBook({ epub, pdfPath, pdfText: text });
  const extracted = parseChapterLines(text);
  const chapters = known?.chapters?.length ? known.chapters : extracted;
  const identity = buildPdfIdentity({ epub, pdfPath, known, extracted });
  return {
    source: path.basename(pdfPath),
    pdfPath,
    mapSource: known ? 'known-book-map' : 'pdf-text',
    canonicalBookId: known?.id || null,
    extractedPdfChapterCount: extracted.length,
    extractedPdfTitles: extracted.map((chapter) => chapter.title),
    knownCanonicalMatched: Boolean(known),
    matchReason: identity.matchReason,
    identityValid: identity.valid,
    identityEvidence: identity.evidence,
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
  return {
    source: null,
    pdfPath: null,
    mapSource: null,
    canonicalBookId: null,
    extractedPdfChapterCount: 0,
    extractedPdfTitles: [],
    knownCanonicalMatched: false,
    matchReason: 'no-pdf',
    identityValid: false,
    identityEvidence: [],
    language: null,
    chapterCount: 0,
    chapters: []
  };
}

function buildPdfIdentity({ epub, pdfPath, known, extracted }) {
  const evidence = [];
  const epubTitle = epub?.opf?.metadata?.title || '';
  const epubBase = path.basename(epub?.sourcePath || '', path.extname(epub?.sourcePath || ''));
  const pdfBase = path.basename(pdfPath || '', path.extname(pdfPath || ''));
  const baseSimilarity = tokenSimilarity(epubBase, pdfBase);
  const titleSimilarity = tokenSimilarity(epubTitle, pdfBase);

  if (known) {
    evidence.push({ type: 'known-canonical-epub-match', canonicalBookId: known.id });
    return { valid: true, matchReason: 'known-canonical-matched-epub-identity', evidence };
  }

  evidence.push({ type: 'base-name-similarity', epubBase, pdfBase, similarity: baseSimilarity });
  evidence.push({ type: 'title-to-pdf-name-similarity', epubTitle, pdfBase, similarity: titleSimilarity });
  evidence.push({ type: 'pdf-extracted-chapters', count: extracted.length });

  const valid = baseSimilarity >= 0.72 || titleSimilarity >= 0.72;
  return {
    valid,
    matchReason: valid ? 'pdf-name-compatible-with-epub' : 'pdf-name-not-compatible-with-epub',
    evidence
  };
}

function tokenSimilarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return Number((intersection / union).toFixed(3));
}

function tokenSet(value) {
  return new Set(String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !['the', 'and', 'com', 'www', 'pdf', 'epub'].includes(token)));
}
