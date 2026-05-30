import { cleanText, isFileNameTitle, isGenericTitle, looksLikeChapterTitle } from '../utils/text-utils.js';

export function analyzeTitleQuality(title, doc, score = 0) {
  const normalized = cleanText(title);

  if (!normalized) return result('invalid', 'EMPTY_TITLE');
  if (isGenericTitle(normalized)) return result('invalid', 'GENERIC_TITLE');
  if (isFileNameTitle(normalized)) return result('invalid', 'FILENAME_TITLE');
  if (/^bsj$/i.test(normalized)) return result('invalid', 'MARKER_NOT_TITLE');
  if (isDialogueOrSentence(normalized)) return result('invalid', 'TEXT_FRAGMENT_TITLE');
  if (looksLikeChapterTitle(normalized)) return result('valid', 'CHAPTER_PATTERN');

  if (score >= 30 && (doc?.wordCount || 0) > 100) {
    return result('suspicious', 'UNNUMBERED_POSSIBLE_TITLE');
  }

  return result('invalid', 'UNKNOWN_PATTERN');
}

function isDialogueOrSentence(value) {
  const text = cleanText(value);
  if (/^[“"'].*[”"']?[.!?]?$/.test(text)) return true;
  if (text.split(' ').length > 8) return true;
  return false;
}

function result(quality, reason) {
  return { quality, reason };
}
