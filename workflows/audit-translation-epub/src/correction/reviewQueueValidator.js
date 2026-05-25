const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected', 'needs_context']);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function itemLabel(item, index) {
  return item?.id || `item_${index + 1}`;
}

function pushIssue(list, item, index, field, message) {
  list.push({
    itemId: itemLabel(item, index),
    field,
    message,
  });
}

export function validateReviewQueue(reviewQueue) {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(reviewQueue?.items) ? reviewQueue.items : [];

  if (!reviewQueue) {
    return {
      ok: false,
      errors: [{ itemId: null, field: 'reviewQueue', message: 'review-queue.json nao encontrado ou invalido.' }],
      warnings,
      summary: {
        totalItems: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        needsContext: 0,
      },
    };
  }

  items.forEach((item, index) => {
    if (!ALLOWED_STATUSES.has(item.status)) {
      pushIssue(errors, item, index, 'status', `Status invalido: ${item.status || '(vazio)'}.`);
      return;
    }

    if (item.status !== 'approved') return;

    if (!hasText(item.before)) {
      pushIssue(errors, item, index, 'before', 'Item approved precisa de before preenchido.');
    }
    if (!hasText(item.after)) {
      pushIssue(errors, item, index, 'after', 'Item approved precisa de after preenchido.');
    }
    if (hasText(item.before) && hasText(item.after) && item.before === item.after) {
      pushIssue(errors, item, index, 'after', 'Item approved precisa de after diferente de before.');
    }
    if (!hasText(item.filePath)) {
      pushIssue(errors, item, index, 'filePath', 'Item approved precisa de filePath preenchido.');
    }
    if (!hasText(item.nodeId)) {
      pushIssue(errors, item, index, 'nodeId', 'Item approved precisa de nodeId preenchido.');
    }
    if (!Number.isInteger(item.paragraphIndex) || !Number.isInteger(item.textNodeIndex)) {
      pushIssue(errors, item, index, 'xhtmlLocation', 'Item approved precisa de paragraphIndex e textNodeIndex validos.');
    }
    if (item.status === 'approved' && item.mode === 'manual_only') {
      pushIssue(warnings, item, index, 'mode', 'Item manual_only aprovado exige revisao humana extra antes do fixEpub.');
    }
  });

  const summary = {
    totalItems: items.length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    pending: items.filter((item) => item.status === 'pending').length,
    needsContext: items.filter((item) => item.status === 'needs_context').length,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

export function formatReviewQueueValidation(validation) {
  const lines = [
    `Status: ${validation.ok ? 'OK' : 'FAIL'}`,
    `Itens: ${validation.summary.totalItems}`,
    `Approved: ${validation.summary.approved}`,
    `Rejected: ${validation.summary.rejected}`,
    `Pending: ${validation.summary.pending}`,
    `Needs context: ${validation.summary.needsContext}`,
  ];

  if (validation.errors.length) {
    lines.push('', 'ERROS:');
    for (const error of validation.errors) {
      lines.push(`- ${error.itemId || '-'} [${error.field}]: ${error.message}`);
    }
  }

  if (validation.warnings.length) {
    lines.push('', 'WARNINGS:');
    for (const warning of validation.warnings) {
      lines.push(`- ${warning.itemId || '-'} [${warning.field}]: ${warning.message}`);
    }
  }

  return lines.join('\n');
}
