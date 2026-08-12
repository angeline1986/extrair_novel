import { cleanText, normalizeKey } from '../../utils/text-utils.js';
import { parseChapterHeading } from '../../utils/chapter-parser.js';

export function buildReferenceDocument({ sourceType, sourceFile, language = null, title = null, chapters = [] }) {
  return {
    sourceType,
    sourceFile,
    language,
    title,
    chapters: chapters.map(normalizeReferenceChapter).filter((chapter) => Number.isInteger(chapter.number))
  };
}

export function normalizeReferenceChapter(chapter) {
  const parsed = parseChapterHeading(chapter.heading || chapter.title || '');
  const number = Number.isInteger(chapter.number) ? chapter.number : parsed.chapterNumber;
  const title = cleanText(chapter.title || parsed.title || chapter.heading || `Capítulo ${number}`);
  const text = cleanText(chapter.text || '');
  return {
    number,
    title,
    heading: cleanText(chapter.heading || title),
    text,
    normalizedText: normalizeAuditText(text),
    sourceLocation: chapter.sourceLocation || null,
    confidence: chapter.confidence || 'medium',
    firstText: firstWords(text),
    lastText: lastWords(text)
  };
}

export function normalizeAuditText(value) {
  return normalizeKey(value).replace(/\s+/g, ' ').trim();
}

export function firstWords(value, count = 2) {
  return cleanText(value).split(/\s+/).filter(Boolean).slice(0, count).join(' ');
}

export function lastWords(value, count = 2) {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  return words.slice(Math.max(0, words.length - count)).join(' ');
}
