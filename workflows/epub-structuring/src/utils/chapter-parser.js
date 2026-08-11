import { cleanText } from './text-utils.js';

const EXPLICIT_PREFIX_PATTERN = /^(cap[ií]tulo|chapter|cap\.)\s+(\d{1,4})(?:\s*[.:—–-]\s*|\s+)(.+)$/i;
const NUMBERED_PATTERN = /^(\d{1,4})[\.\)]\s+(.+)$/;

export function parseChapterHeading(text, context = {}) {
  const originalText = cleanText(text);
  if (!originalText) return unmatched(text);

  const explicit = originalText.match(EXPLICIT_PREFIX_PATTERN);
  if (explicit) {
    return buildMatch({
      originalText,
      chapterNumber: Number(explicit[2]),
      title: explicit[3],
      format: 'explicit-prefix',
      tagName: context.tagName,
      sequenceCompatible: context.sequenceCompatible
    });
  }

  const numbered = originalText.match(NUMBERED_PATTERN);
  if (numbered) {
    return buildMatch({
      originalText,
      chapterNumber: Number(numbered[1]),
      title: numbered[2],
      format: 'numbered-punctuation',
      tagName: context.tagName,
      sequenceCompatible: context.sequenceCompatible
    });
  }

  return unmatched(text);
}

export function normalizeChapterHeading(text) {
  const parsed = parseChapterHeading(text);
  return parsed.matched ? parsed.displayTitle : cleanText(text);
}

export function normalizeChapterTitle(text) {
  return cleanText(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMatch({ originalText, chapterNumber, title, format, tagName, sequenceCompatible }) {
  const normalizedTitle = cleanText(title);
  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0 || !normalizedTitle) {
    return unmatched(originalText);
  }

  const { confidence, confidenceScore, confidenceReasons } = scoreConfidence({
    format,
    tagName,
    title: normalizedTitle,
    sequenceCompatible
  });

  return {
    matched: true,
    chapterNumber,
    title: normalizedTitle,
    displayTitle: `${chapterNumber}. ${normalizedTitle}`,
    originalText,
    format,
    confidence,
    confidenceScore,
    confidenceReasons
  };
}

function scoreConfidence({ format, tagName, title, sequenceCompatible }) {
  const reasons = [];
  let score = 0;
  const maxScore = 90;

  if (format === 'explicit-prefix') {
    score += 40;
    reasons.push('explicit-prefix');
  } else if (format === 'numbered-punctuation') {
    score += 30;
    reasons.push('numbered-punctuation');
  }

  score += 20;
  reasons.push('valid-number');

  const tag = String(tagName || '').toLowerCase();
  if (['h1', 'h2'].includes(tag)) {
    score += 15;
    reasons.push('heading-tag');
  } else if (['h3', 'p'].includes(tag)) {
    score += 10;
    reasons.push('block-tag');
  } else if (['div', 'strong', 'b'].includes(tag)) {
    score += 6;
    reasons.push('secondary-tag');
  } else if (tag === 'span') {
    score += 3;
    reasons.push('inline-tag');
  }

  if (title.length >= 2 && title.length <= 140) {
    score += 5;
    reasons.push('non-empty-title');
  }

  if (sequenceCompatible === true) {
    score += 10;
    reasons.push('sequence-compatible');
  }

  return {
    confidence: Number(Math.min(score / maxScore, 1).toFixed(2)),
    confidenceScore: score,
    confidenceReasons: reasons
  };
}

function unmatched(text) {
  return {
    matched: false,
    originalText: cleanText(text)
  };
}
