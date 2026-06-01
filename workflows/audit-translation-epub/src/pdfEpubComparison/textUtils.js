export function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function preview(value, limit = 300) {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractChapterNumber(text) {
  const match = String(text || '').match(/^(\d+)[.)]?\s+\S/);
  return match ? Number(match[1]) : null;
}

export function stripChapterNumber(text) {
  return compact(String(text || '').replace(/^\d+[.)]?\s*/, ''));
}

export function chapterLabel(chapter) {
  return Number.isInteger(chapter) ? String(chapter) : String(chapter || '-');
}

export function titleForSection(section) {
  const title = compact(section?.title || '');
  if (extractChapterNumber(title)) return title;
  const heading = (section?.headings || []).find((item) => extractChapterNumber(item));
  if (heading) return heading;
  const paragraph = (section?.paragraphs || []).slice(0, 5).find((item) => extractChapterNumber(item));
  return paragraph || title || '-';
}

export function indexSectionsByChapter(doc) {
  const index = new Map();
  for (const section of doc?.sections || []) {
    const candidates = [
      section.chapterNumber,
      extractChapterNumber(section.title),
      ...(section.headings || []).map(extractChapterNumber),
      ...(section.paragraphs || []).slice(0, 3).map(extractChapterNumber),
    ].filter((value) => Number.isInteger(value));
    if (!candidates.length) continue;
    if (!index.has(candidates[0])) index.set(candidates[0], section);
  }
  return index;
}

export function sentenceContaining(text, needle, limit = 320) {
  const compactText = compact(text);
  if (!needle) return preview(compactText, limit);
  const normalizedNeedle = normalizeComparable(needle);
  const sentence = compactText
    .split(/(?<=[.!?…])\s+/u)
    .map(compact)
    .find((item) => normalizeComparable(item).includes(normalizedNeedle));
  return preview(sentence || compactText, limit);
}

export function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textHasTerm(text, term) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  return pattern.test(String(text || ''));
}

export function containsNormalized(text, needle) {
  if (!needle) return false;
  return normalizeComparable(text).includes(normalizeComparable(needle));
}
