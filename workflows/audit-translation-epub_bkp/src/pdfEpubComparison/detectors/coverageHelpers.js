import { isCommonWord, normalizeLexiconWord } from '../../languageLexicons.js';
import { normalizeComparable } from '../textUtils.js';

export function extractNumbers(value) {
  return [...new Set(String(value || '').match(/\d+(?:[.,]\d+)?/g) || [])];
}

export function hasStandaloneNumber(text, number) {
  const escaped = String(number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d])${escaped}(?=$|[^\\d])`, 'u').test(String(text || ''));
}

export function hasEquivalentNumber(targetText, sourceText, number) {
  if (hasStandaloneNumber(targetText, number)) return true;
  if (!isCentimeterValue(sourceText, number)) return false;

  const meters = (Number(number) / 100).toFixed(2);
  const variants = [
    meters.replace('.', ','),
    meters,
  ];

  return variants.some((variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\d])${escaped}\\s*(?:m|metro|metros)(?=$|[^\\p{L}\\p{N}])`, 'iu')
      .test(String(targetText || ''));
  });
}

function isCentimeterValue(text, number) {
  const escaped = String(number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d])${escaped}\\s*(?:cm|cent[ií]metro|cent[ií]metros)(?=$|[^\\p{L}\\p{N}])`, 'iu')
    .test(String(text || ''));
}

export function extractProperNames(value) {
  const blocked = new Set(['Era', 'Una', 'Uma', 'Ele', 'Ela', 'Para', 'Com', 'Sem', 'Mas', 'Como']);
  return [...new Set(String(value || '').match(/\b[\p{Lu}][\p{L}\p{N}'-]{2,}\b/gu) || [])]
    .filter((item) => {
      if (blocked.has(item)) return false;
      const normalized = normalizeLexiconWord(item);
      if (isCommonWord(normalized, 'es') || isCommonWord(normalized, 'pt')) return false;
      return /-|doih|hyeon|hyun|jeong|woon|taewoon|seon|yumin|yu-min/i.test(item) ||
        /^(do|seo|lee|kim|park|choi|han|kang)$/i.test(item);
    });
}

export function missingItems(sourceItems, targetText) {
  const normalizedTarget = normalizeComparable(targetText);
  return sourceItems.filter((item) => !normalizedTarget.includes(normalizeComparable(item)));
}
