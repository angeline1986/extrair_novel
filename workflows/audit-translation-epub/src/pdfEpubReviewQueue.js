const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function preview(value, limit = 700) {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function stableReviewId(stableKey) {
  let hash = 5381;
  for (const char of String(stableKey || 'pdf-epub-item')) {
    hash = ((hash << 5) + hash) + char.charCodeAt(0);
    hash >>>= 0;
  }
  return `pdfepub${String(hash % 100000).padStart(5, '0')}`;
}

function previousItemByKey(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    if (!item.stableKey) continue;
    map.set(item.stableKey, item);
  }
  return map;
}

function previousItemByDedupeKey(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    const key = item.dedupeKey || dedupeKeyFromFinding({ id: item.categoryId }, item);
    if (!key) continue;
    map.set(key, item);
  }
  return map;
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

function quotedRecommendation(value) {
  const match = String(value || '').match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function titleLikeValue(value) {
  const text = compact(value);
  const match = text.match(/(\d+[.)]\s*[^:|]+)/);
  return compact(match?.[1] || text);
}

function dedupeKeyFromFinding(category, finding) {
  const recommendation = quotedRecommendation(finding?.recommendation || finding?.recommended) ||
    finding?.recommendation ||
    finding?.recommended ||
    '';
  const title = titleLikeValue(finding?.translation || finding?.location || finding?.original || '');
  if (!recommendation || !title) return null;
  return [
    finding?.chapter || '-',
    normalizeComparable(title),
    normalizeComparable(recommendation),
  ].join('::');
}

function categoryPriority(categoryId) {
  const priorities = {
    terminology_inconsistency: 1,
    semantic_drift: 2,
    editorial_findings: 3,
  };
  return priorities[categoryId] || 9;
}

function stableKeyFromFinding(category, finding) {
  return [
    category?.id || '-',
    finding?.chapter || '-',
    finding?.type || '-',
    finding?.original || finding?.sourceTerm || '-',
    finding?.translation || finding?.location || '-',
    finding?.recommendation || finding?.recommended || '-',
  ].join('::');
}

function recommendationForFinding(finding) {
  return finding?.recommendation || finding?.recommended || 'Validar manualmente no contexto.';
}

function findingProblem(finding) {
  return finding?.problem || finding?.type || 'Achado editorial PDF x EPUB.';
}

function buildItemFromFinding(category, finding, existingItem = {}) {
  const stableKey = stableKeyFromFinding(category, finding);
  const dedupeKey = dedupeKeyFromFinding(category, finding);
  const previousStatus = REVIEW_STATUSES.has(existingItem.status) ? existingItem.status : 'pending';
  const now = new Date().toISOString();

  return {
    id: existingItem.id || stableReviewId(stableKey),
    stableKey,
    dedupeKey,
    origin: 'pdf_epub_comparison',
    categoryId: category.id,
    categoryLabel: category.label,
    type: finding.type || category.label,
    status: previousStatus,
    chapter: finding.chapter || '-',
    severity: finding.severity || 'medium',
    confidence: finding.confidence || 'medium',
    original: preview(finding.original || finding.sourceTerm || ''),
    translation: preview(finding.translation || ''),
    problem: preview(findingProblem(finding)),
    recommendation: preview(recommendationForFinding(finding)),
    location: preview(finding.location || ''),
    problematicTerm: finding.problematicTerm || finding.sourceTerm || '',
    sourceTerm: finding.sourceTerm || finding.original || '',
    review: existingItem.review || {
      approvedBy: null,
      reviewedAt: null,
      notes: null,
    },
    application: existingItem.application || null,
    createdAt: existingItem.createdAt || now,
    updatedAt: now,
  };
}

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length;
}

export function buildPdfEpubReviewQueue({
  audit,
  existingQueue = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const previousItems = previousItemByKey(existingQueue);
  const previousDedupeItems = previousItemByDedupeKey(existingQueue);
  const rawFindings = (audit?.categories || []).flatMap((category) =>
    (category.findings || []).map((finding) => ({ category, finding }))
  );
  const byDedupeKey = new Map();
  const findings = [];

  for (const entry of rawFindings) {
    const key = dedupeKeyFromFinding(entry.category, entry.finding);
    if (!key) {
      findings.push(entry);
      continue;
    }

    const current = byDedupeKey.get(key);
    if (!current) {
      byDedupeKey.set(key, entry);
      continue;
    }

    if (categoryPriority(entry.category.id) < categoryPriority(current.category.id)) {
      byDedupeKey.set(key, entry);
    }
  }

  findings.push(...byDedupeKey.values());

  const items = findings.map(({ category, finding }) => {
    const stableKey = stableKeyFromFinding(category, finding);
    const dedupeKey = dedupeKeyFromFinding(category, finding);
    return buildItemFromFinding(
      category,
      finding,
      previousItems.get(stableKey) || previousDedupeItems.get(dedupeKey) || {}
    );
  });

  return {
    schemaVersion: '1.0',
    generatedAt,
    sourceAuditGeneratedAt: audit?.generatedAt || null,
    origin: 'pdf_epub_comparison',
    summary: {
      totalItems: items.length,
      pending: countByStatus(items, 'pending'),
      approved: countByStatus(items, 'approved'),
      rejected: countByStatus(items, 'rejected'),
    },
    items,
  };
}

export function refreshPdfEpubReviewQueueSummary(queue) {
  const items = queue.items || [];
  queue.summary = {
    ...(queue.summary || {}),
    totalItems: items.length,
    pending: countByStatus(items, 'pending'),
    approved: countByStatus(items, 'approved'),
    rejected: countByStatus(items, 'rejected'),
  };
}
