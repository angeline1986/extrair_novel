function suggestionId(index) {
  return `ars-${String(index + 1).padStart(4, '0')}`;
}

function canSuggestReplacement(item) {
  return Boolean(
    typeof item.before === 'string' &&
    item.before.trim() &&
    typeof item.after === 'string' &&
    item.after.trim() &&
    item.before !== item.after
  );
}

function hasProbablyValidPortuguesePattern(item) {
  const examples = item.examples || [];
  const text = [
    item.textPreview || '',
    ...examples.map((example) => `${example.match || ''} ${example.context || ''}`),
  ].join(' ').toLocaleLowerCase();

  const validPatterns = [
    /\ba tempo\b/u,
    /\bbem a tempo\b/u,
    /\ba lugar nenhum\b/u,
    /\bdeixando-o\s+\p{L}+mente\b/u,
    /\bobservando-o\s+\p{L}+mente\b/u,
    /\bencarando-o\s+\p{L}+mente\b/u,
    /\bpegando-o\s+\p{L}+mente\b/u,
  ];

  return validPatterns.some((pattern) => pattern.test(text));
}

function beforeText(item) {
  return item.before || item.textPreview || null;
}

function suggestedAfter(item) {
  return canSuggestReplacement(item) ? item.after : null;
}

function suggestionStatus(item) {
  if (canSuggestReplacement(item)) return 'suggestion_available';
  if (item.type === 'residual_english_review') return 'needs_human_translation';
  return 'insufficient_context';
}

function reasonForItem(item) {
  if (canSuggestReplacement(item)) {
    return 'Item possui before/after preenchidos na review queue; suggestedAfter foi preservado como sugestao, mas ainda requer aprovacao humana.';
  }

  if (hasProbablyValidPortuguesePattern(item)) {
    return 'Heuristica conservadora detectou padrao que pode ser gramaticalmente valido em portugues; nenhuma troca explicita foi sugerida sem revisao humana.';
  }

  if (item.type === 'gender_agreement_review') {
    return 'Possivel problema de genero/concordancia, mas o contexto nao e suficiente para sugerir uma troca segura sem aprovacao humana.';
  }

  if (item.type === 'residual_english_review') {
    return 'Possivel residuo em ingles; traducao exige decisao humana ou modelo opcional antes de preencher suggestedAfter.';
  }

  return 'Item exige revisao humana; nenhuma reescrita automatica foi inferida.';
}

function confidenceForItem(item) {
  if (canSuggestReplacement(item)) {
    return Math.min(Number(item.confidence || 0.7), 0.85);
  }
  if (hasProbablyValidPortuguesePattern(item)) {
    return 0.35;
  }
  return Math.min(Number(item.confidence || 0.5), 0.6);
}

function buildSuggestion(item, index) {
  return {
    id: suggestionId(index),
    reviewQueueItemId: item.id,
    actionId: item.actionId || null,
    candidateId: item.candidateId || null,
    type: item.type || null,
    mode: item.mode || null,
    status: item.status || 'pending',
    filePath: item.filePath || null,
    nodeId: item.nodeId || null,
    textPreview: item.textPreview || null,
    previousParagraph: item.previousParagraph || null,
    currentParagraph: item.currentParagraph || null,
    nextParagraph: item.nextParagraph || null,
    originalAlignedText: item.originalAlignedText || null,
    before: beforeText(item),
    suggestedAfter: suggestedAfter(item),
    suggestionStatus: suggestionStatus(item),
    reason: reasonForItem(item),
    confidence: confidenceForItem(item),
    requiresHumanApproval: true,
    source: 'deterministic_fallback',
  };
}

export function buildAssistedReviewSuggestions({
  reviewQueue,
  createdAt = new Date().toISOString(),
} = {}) {
  const sourceItems = (reviewQueue?.items || [])
    .filter((item) => item.status === 'pending' && item.mode === 'auto_review');
  const suggestions = sourceItems.map(buildSuggestion);

  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    source: {
      reviewQueueCreatedAt: reviewQueue?.createdAt || null,
    },
    summary: {
      totalSuggestions: suggestions.length,
      requiresHumanApproval: suggestions.filter((item) => item.requiresHumanApproval).length,
      withSuggestedAfter: suggestions.filter((item) => item.suggestedAfter).length,
      contextEnriched: suggestions.filter((item) => item.currentParagraph || item.previousParagraph || item.nextParagraph || item.originalAlignedText).length,
      suggestionAvailable: suggestions.filter((item) => item.suggestionStatus === 'suggestion_available').length,
      needsHumanTranslation: suggestions.filter((item) => item.suggestionStatus === 'needs_human_translation').length,
      insufficientContext: suggestions.filter((item) => item.suggestionStatus === 'insufficient_context').length,
      deterministicFallback: suggestions.filter((item) => item.source === 'deterministic_fallback').length,
    },
    suggestions,
  };
}

export function renderAssistedReviewMarkdown(assistedReview) {
  const suggestions = assistedReview?.suggestions || [];
  const summary = assistedReview?.summary || {};

  return [
    '# Sugestoes Assistidas EPUB',
    '',
    `Gerado em: ${assistedReview?.createdAt || '-'}`,
    `Total: ${summary.totalSuggestions || 0}`,
    `Requer aprovacao humana: ${summary.requiresHumanApproval || 0}`,
    `Com suggestedAfter: ${summary.withSuggestedAfter || 0}`,
    `Com contexto expandido: ${summary.contextEnriched || 0}`,
    `Suggestion available: ${summary.suggestionAvailable || 0}`,
    `Needs human translation: ${summary.needsHumanTranslation || 0}`,
    `Insufficient context: ${summary.insufficientContext || 0}`,
    `Fallback deterministico: ${summary.deterministicFallback || 0}`,
    '',
    'Nenhuma sugestao deste arquivo e aplicada automaticamente.',
    '',
    '| ID | Review item | Status | Tipo | Arquivo | Node | Confidence | Before | Suggested after | Contexto | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(suggestions.length
      ? suggestions.map((item) => [
        item.id,
        item.reviewQueueItemId || '-',
        item.suggestionStatus || '-',
        item.type || '-',
        item.filePath || '-',
        item.nodeId || '-',
        item.confidence ?? '-',
        String(item.before || '-').replace(/\s+/g, ' ').slice(0, 180),
        String(item.suggestedAfter || '-').replace(/\s+/g, ' ').slice(0, 180),
        String(item.currentParagraph || item.textPreview || '-').replace(/\s+/g, ' ').slice(0, 180),
        item.reason || '-',
      ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ')).map((row) => `| ${row} |`)
      : ['| - | - | - | - | - | - | Nenhuma sugestao gerada | - | - |']),
    '',
  ].join('\n');
}
