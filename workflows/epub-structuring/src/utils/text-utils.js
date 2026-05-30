export function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeFileName(value) {
  const cleaned = cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'book';
}

export function extractChapterNumber(value) {
  const text = cleanText(value);
  const match = text.match(/(?:cap[ií]tulo|chapter|cap\.?|^)[\s:.-]*(\d{1,4})\b/i);
  return match ? Number(match[1]) : null;
}

export function isFileNameTitle(value) {
  const text = cleanText(value).toLowerCase();
  return /^(index_split_|split_|chapter_|chap_|page_|text\/|xhtml\/)/.test(text) || /\.(xhtml|html)$/i.test(text);
}

export function isGenericTitle(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return true;
  if (/^\*{1,5}$/.test(text)) return true;
  if (/^[-–—_•·]+$/.test(text)) return true;
  if (/^(bsj|converted ebook|untitled|sem título|sin título|começar|start)$/i.test(text)) return true;
  if (/^cap[ií]tulo\s*\d*$/i.test(text)) return true;
  return false;
}

export function looksLikeChapterTitle(value) {
  const text = cleanText(value);
  if (!text || isGenericTitle(text) || isFileNameTitle(text)) return false;
  if (text.length > 90) return false;
  if ((text.match(/[.!?…]/g) || []).length > 0 && text.split(/\s+/).length > 5) return false;
  if (/\b(murmur[oó]|dijo|pregunt[oó]|respond[ií]o|susurr[oó]|mir[oó])\b/i.test(text)) return false;
  return true;
}

export function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
