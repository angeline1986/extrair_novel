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

function bestTitleLikeValue(finding) {
  const values = [finding?.location, finding?.translation, finding?.original];
  const titleValue = values.find((value) => /\d+[.)]\s*/.test(String(value || '')));
  return titleLikeValue(titleValue || values.find(Boolean) || '');
}

function normalizedRecommendation(value) {
  const quoted = quotedRecommendation(value);
  return compact(quoted || value)
    .replace(/^avaliar substitui[cç][aã]o por\s+/iu, '')
    .replace(/^verificar se .* deveria conter\s+/iu, '')
    .replace(/^padronizar para\s+/iu, '')
    .replace(/^trocar por\s+/iu, '')
    .replace(/^substituir por\s+/iu, '')
    .replace(/^["“”]+|["“”.]+$/g, '')
    .trim();
}

export function dedupeKeyFromFinding(category, finding) {
  const recommendation = normalizedRecommendation(finding?.recommendation);
  const title = bestTitleLikeValue(finding);
  if (!recommendation || !title) return null;
  const scope = /^\d+[.)]\s*/.test(title) ? 'title' : finding?.chapter || '-';
  return [scope, normalizeComparable(title), normalizeComparable(recommendation)].join('::');
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
