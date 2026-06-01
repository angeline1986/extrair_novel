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
  if (!term) return escaped;
  const pattern = new RegExp(`(${escapeRegExp(escapeHtml(term))})`, 'gi');
  return escaped.replace(pattern, '<strong>$1</strong>');
}
