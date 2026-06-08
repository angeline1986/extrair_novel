export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export function safeId(value) {
  return String(value || 'tab')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function highlightTerm(value, term) {
  const escaped = escapeHtml(value || '-');
  const terms = (Array.isArray(term) ? term : String(term || '').split(/\s*\/\s*/))
    .map((item) => escapeHtml(String(item || '').trim()))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return escaped;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${terms.map(escapeRegExp).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return escaped.replace(pattern, '$1<strong>$2</strong>');
}
