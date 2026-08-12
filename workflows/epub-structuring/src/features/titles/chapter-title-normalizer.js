import { cleanText } from '../../utils/text-utils.js';

const CHAPTER_TITLE_PATTERN = /^(cap[ií]tulo|chapter|cap\.)\s+(\d{1,4})(?:\s*[:.]\s*|\s+)(.*)$/i;

export function parseDisplayChapterTitle(value) {
  const original = cleanText(value);
  const match = original.match(CHAPTER_TITLE_PATTERN);
  if (!match) return { matched: false, original, number: null, title: original, normalized: original, changed: false, reason: 'unmatched' };

  const prefix = canonicalPrefix(match[1]);
  const number = Number(match[2]);
  const title = cleanText(match[3]);
  if (!Number.isInteger(number) || number <= 0 || !title) {
    return { matched: false, original, number: Number.isInteger(number) ? number : null, title, normalized: original, changed: false, reason: 'missing-title' };
  }

  const normalized = `${prefix} ${number}: ${title}`;
  return {
    matched: true,
    original,
    number,
    title,
    normalized,
    changed: original !== normalized,
    reason: original === normalized ? 'already-normalized' : 'normalized'
  };
}

export function normalizeDisplayChapterTitle(value) {
  return parseDisplayChapterTitle(value).normalized;
}

function canonicalPrefix(prefix) {
  return /^chapter$/i.test(prefix) ? 'Chapter' : 'Capítulo';
}
