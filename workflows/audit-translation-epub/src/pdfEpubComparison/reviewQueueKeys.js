export function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function preview(value, limit = 700) {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stableReviewId(stableKey) {
  let hash = 5381;
  for (const char of String(stableKey || 'pdf-epub-item')) {
    hash = ((hash << 5) + hash) + char.charCodeAt(0);
    hash >>>= 0;
  }
  return `pdfepub${String(hash % 100000).padStart(5, '0')}`;
}

function quotedRecommendation(value) {
  const match = String(value || '').match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function titleLikeValue(value) {
  const text = compact(value);
  const match = text.match(/(\d+[.)]\s*[^:|]+)/);
  return compact(match?.[1] || text);
}

export function dedupeKeyFromFinding(category, finding) {
  const recommendation = quotedRecommendation(finding?.recommendation) || finding?.recommendation || '';
  const title = titleLikeValue(finding?.translation || finding?.location || finding?.original || '');
  if (!recommendation || !title) return null;
  return [finding?.chapter || '-', normalizeComparable(title), normalizeComparable(recommendation)].join('::');
}

export function stableKeyFromFinding(category, finding) {
  return [
    category?.id || '-',
    finding?.chapter || '-',
    finding?.type || '-',
    finding?.original || '-',
    finding?.translation || finding?.location || '-',
    finding?.recommendation || '-',
  ].join('::');
}
