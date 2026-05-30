export function detectFrontmatter(item, doc, title = '') {
  const href = String(item?.href || item?.fullPath || '').toLowerCase();
  const text = String(doc?.text || '').toLowerCase();
  const label = String(title || '').toLowerCase();
  if (item?.linear === 'no') return true;
  if (/titlepage|cover|copyright|dedication|toc|nav|index_split_000/.test(href)) return true;
  if (/^(começar|start|cover|capa|title page|converted ebook)$/.test(label.trim())) return true;
  if ((doc?.wordCount || 0) < 60 && /copyright|índice|indice|sumário|sumario/.test(text)) return true;
  return false;
}
