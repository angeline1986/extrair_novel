export function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isGenericTitle(value) {
  const text = cleanText(value).toLowerCase();
  return ['converted ebook', 'ebook', 'untitled', 'sem título', 'sin título'].includes(text);
}

export function isFileNameTitle(value) {
  return /^index_split_\d+\.x?html$/i.test(cleanText(value)) || /^.+\.x?html$/i.test(cleanText(value));
}

export function looksLikeChapterTitle(value) {
  const text = cleanText(value);
  return [
    /^cap[ií]tulo\s+\d+/i,
    /^chapter\s+\d+/i,
    /^cap\.?\s*\d+/i,
    /^\d+\s*[.．、:-]\s*.+/,
    /^pr[oó]logo$/i,
    /^ep[ií]logo$/i,
    /^extra$/i
  ].some((pattern) => pattern.test(text));
}

export function extractChapterNumber(value) {
  const match = cleanText(value).match(/^(?:cap[ií]tulo|chapter|cap\.?)?\s*(\d+)\s*[.．、:-]?/i);
  return match ? Number(match[1]) : null;
}

export function safeFileName(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'book';
}
