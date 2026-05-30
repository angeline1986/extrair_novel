import { cleanText, isGenericTitle, isFileNameTitle, looksLikeChapterTitle } from '../utils/text-utils.js';

export function extractBestTitle(doc, tocEntry, item) {
  const candidates = collectCandidates(doc, tocEntry, item);
  const scored = candidates.map((title) => ({ title, score: scoreTitle(title) }))
    .sort((a, b) => b.score - a.score);

  const best = scored.find((entry) => entry.score > 0);
  return best || { title: item.href, score: 0 };
}

function collectCandidates(doc, tocEntry, item) {
  const base = [
    doc?.heading,
    doc?.firstBold,
    tocEntry?.label,
    doc?.firstParagraph,
    doc?.title,
    item.href
  ];

  return [...base, ...(doc?.blockTexts || [])]
    .map(cleanText)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function scoreTitle(value) {
  const title = cleanText(value);

  if (!title || isGenericTitle(title) || isFileNameTitle(title)) return 0;
  if (/^bsj$/i.test(title)) return 0;
  if (looksLikeChapterTitle(title)) return 100;
  if (isLikelyBodyText(title)) return 0;
  if (title.length <= 60 && title.split(' ').length <= 6) return 30;

  return 0;
}

function isLikelyBodyText(value) {
  const text = cleanText(value);
  if (/^[“"'].*[”"']?[.!?]?$/.test(text)) return true;
  if (text.split(' ').length > 8) return true;
  return false;
}
