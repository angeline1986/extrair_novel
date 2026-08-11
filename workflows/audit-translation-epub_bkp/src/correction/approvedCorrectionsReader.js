const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'needs_context']);

function isInteger(value) {
  return Number.isInteger(value);
}

function locationFromItem(item) {
  return {
    id: item.nodeId || null,
    filePath: item.filePath || null,
    spineIndex: item.spineIndex ?? null,
    paragraphIndex: item.paragraphIndex ?? null,
    textNodeIndex: item.textNodeIndex ?? null,
    textPreview: item.textPreview || null,
  };
}

function hasUsableLocation(item) {
  return Boolean(
    item.filePath &&
    isInteger(item.paragraphIndex) &&
    isInteger(item.textNodeIndex)
  );
}

function hasBeforeAfter(item) {
  return Boolean(
    typeof item.before === 'string' &&
    item.before.trim() &&
    typeof item.after === 'string' &&
    item.after.trim() &&
    item.before !== item.after
  );
}

function skippedItem(item, reason) {
  return {
    reviewQueueItemId: item.id || null,
    actionId: item.actionId || null,
    candidateId: item.candidateId || null,
    type: item.type || null,
    mode: item.mode || null,
    status: item.status || 'pending',
    source: 'review_queue',
    reason,
    filePath: item.filePath || null,
    nodeId: item.nodeId || null,
    confidence: item.confidence ?? null,
  };
}

function approvedAction(item, index) {
  const location = locationFromItem(item);

  return {
    id: `rq-approved-${String(index + 1).padStart(4, '0')}`,
    candidateId: item.candidateId || item.id,
    reviewQueueItemId: item.id,
    type: item.type,
    mode: item.mode,
    status: 'approved',
    source: 'review_queue_approved',
    confidence: item.confidence ?? null,
    risk: item.risk || null,
    target: {
      scope: 'translation_text',
      ...location,
    },
    locations: [location],
    before: item.before,
    after: item.after,
    reason: item.reason || item.suggestion || 'Item aprovado manualmente na review queue.',
    occurrences: item.occurrences || null,
    details: {
      ...(item.details || {}),
      review: item.review || null,
      originalMode: item.mode || null,
      stableKey: item.stableKey || null,
    },
  };
}

function summarize(items, approvedActions, skippedItems) {
  return {
    totalItems: items.length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    pending: items.filter((item) => item.status === 'pending').length,
    needsContext: items.filter((item) => item.status === 'needs_context').length,
    approvedApplicable: approvedActions.length,
    ignored: skippedItems.length,
  };
}

export function buildApprovedCorrectionActions(reviewQueue) {
  const items = Array.isArray(reviewQueue?.items) ? reviewQueue.items : [];
  const actions = [];
  const skippedItems = [];

  for (const item of items) {
    const status = REVIEW_STATUSES.has(item.status) ? item.status : 'pending';

    if (status !== 'approved') {
      skippedItems.push(skippedItem(item, `review_queue_${status}_not_applied`));
      continue;
    }

    if (!hasBeforeAfter(item)) {
      skippedItems.push(skippedItem(item, 'approved_item_missing_valid_before_after'));
      continue;
    }

    if (!hasUsableLocation(item)) {
      skippedItems.push(skippedItem(item, 'approved_item_missing_xhtml_location'));
      continue;
    }

    actions.push(approvedAction(item, actions.length));
  }

  return {
    schemaVersion: '1.0',
    source: 'review_queue',
    actions,
    skippedItems,
    summary: summarize(items, actions, skippedItems),
  };
}
