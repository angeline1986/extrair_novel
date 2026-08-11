export function createDisabledModelAdapter(reason = 'model_adapter_disabled') {
  return {
    name: 'disabled',
    provider: 'none',
    model: null,
    enabled: false,
    disabledReason: reason,
    async suggest() {
      return {
        ok: false,
        status: 'skipped',
        reason,
      };
    },
  };
}

export function createModelTrace({
  createdAt = new Date().toISOString(),
  adapter = createDisabledModelAdapter(),
} = {}) {
  const resolvedAdapter = adapter || createDisabledModelAdapter();
  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    adapter: {
      name: resolvedAdapter.name || 'unknown',
      provider: resolvedAdapter.provider || 'unknown',
      model: resolvedAdapter.model || null,
      enabled: Boolean(resolvedAdapter.enabled),
      disabledReason: resolvedAdapter.disabledReason || null,
    },
    summary: {
      totalRequests: 0,
      accepted: 0,
      rejected: 0,
      failed: 0,
      skipped: resolvedAdapter.enabled ? 0 : 1,
      fallback: 0,
    },
    items: [],
  };
}

export function appendModelTraceItem(trace, item) {
  if (!trace) return;
  trace.items.push(item);
  if (item.status === 'accepted') trace.summary.accepted += 1;
  else if (item.status === 'rejected') trace.summary.rejected += 1;
  else if (item.status === 'failed') trace.summary.failed += 1;
  else if (item.status === 'skipped') trace.summary.skipped += 1;
  if (item.usedFallback) trace.summary.fallback += 1;
  if (item.prompt) trace.summary.totalRequests += 1;
}
