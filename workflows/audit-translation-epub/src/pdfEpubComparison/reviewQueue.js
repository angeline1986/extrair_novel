import {
  dedupeKeyFromFinding,
  preview,
  stableKeyFromFinding,
  stableReviewId,
} from './reviewQueueKeys.js';

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

function previousItemByKey(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    if (item.stableKey) map.set(item.stableKey, item);
  }
  return map;
}

function previousItemByDedupeKey(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    const key = item.dedupeKey || dedupeKeyFromFinding({ id: item.categoryId }, item);
    if (key) map.set(key, item);
  }
  return map;
}

function categoryPriority(categoryId) {
  return {
    residual_language: 1,
    characters: 2,
    titles: 3,
    terminology: 4,
    meaning: 5,
    coverage: 6,
    editorial: 7,
  }[categoryId] || 9;
}

function buildItemFromFinding(category, finding, existingItem = {}) {
  const stableKey = stableKeyFromFinding(category, finding);
  const now = new Date().toISOString();
  return {
    id: existingItem.id || stableReviewId(stableKey),
    stableKey,
    dedupeKey: dedupeKeyFromFinding(category, finding),
    origin: 'pdf_epub_comparison',
    categoryId: category.id,
    categoryLabel: category.label,
    group: category.id,
    type: finding.type || category.label,
    status: REVIEW_STATUSES.has(existingItem.status) ? existingItem.status : 'pending',
    chapter: finding.chapter || '-',
    severity: finding.severity || 'medium',
    confidence: finding.confidence || 'medium',
    original: preview(finding.original || ''),
    translation: preview(finding.translation || ''),
    problem: preview(finding.problem || finding.type || 'Achado editorial PDF x EPUB.'),
    recommendation: preview(finding.recommendation || 'Validar manualmente no contexto.'),
    location: preview(finding.location || ''),
    problematicTerm: finding.problematicTerm || '',
    sourceTerm: finding.original || '',
    review: existingItem.review || { approvedBy: null, reviewedAt: null, notes: null },
    application: existingItem.application || null,
    createdAt: existingItem.createdAt || now,
    updatedAt: now,
  };
}

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length;
}

function dedupedEntries(rawFindings) {
  const entries = [];
  const byKey = new Map();
  for (const entry of rawFindings) {
    const key = dedupeKeyFromFinding(entry.category, entry.finding);
    if (!key) {
      entries.push(entry);
      continue;
    }
    const current = byKey.get(key);
    if (!current || categoryPriority(entry.category.id) < categoryPriority(current.category.id)) {
      byKey.set(key, entry);
    }
  }
  return [...entries, ...byKey.values()];
}

export function buildPdfEpubReviewQueue({ audit, existingQueue = null, generatedAt = new Date().toISOString() } = {}) {
  const previousItems = previousItemByKey(existingQueue);
  const previousDedupeItems = previousItemByDedupeKey(existingQueue);
  const rawFindings = (audit?.categories || []).flatMap((category) =>
    (category.findings || []).map((finding) => ({ category, finding }))
  );
  const items = dedupedEntries(rawFindings).map(({ category, finding }) => {
    const stableKey = stableKeyFromFinding(category, finding);
    const dedupeKey = dedupeKeyFromFinding(category, finding);
    return buildItemFromFinding(category, finding, previousItems.get(stableKey) || previousDedupeItems.get(dedupeKey) || {});
  });
  return { schemaVersion: '1.0', generatedAt, sourceAuditGeneratedAt: audit?.generatedAt || null, origin: 'pdf_epub_comparison', summary: queueSummary(items), items };
}

function queueSummary(items) {
  return {
    totalItems: items.length,
    pending: countByStatus(items, 'pending'),
    approved: countByStatus(items, 'approved'),
    rejected: countByStatus(items, 'rejected'),
  };
}

export function refreshPdfEpubReviewQueueSummary(queue) {
  queue.summary = { ...(queue.summary || {}), ...queueSummary(queue.items || []) };
}
