import { appendModelTraceItem, createModelTrace } from './modelAdapter.js';

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

function normalizeForTokens(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function contentTokens(value) {
  const stopwords = new Set([
    'para', 'com', 'que', 'uma', 'mais', 'isso', 'essa', 'esse', 'estava',
    'estavam', 'como', 'pela', 'pelo', 'sobre', 'quando', 'onde', 'muito',
    'muita', 'ainda', 'dentro', 'fora', 'there', 'that', 'this', 'with',
    'from', 'into', 'were', 'would', 'could', 'should', 'have', 'they',
  ]);

  return new Set(
    normalizeForTokens(value)
      .match(/[\p{L}\p{N}]{4,}/gu)
      ?.filter((token) => !stopwords.has(token)) || []
  );
}

function textOverlapRatio(a, b) {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.min(left.size, right.size);
}

function hasReliableOriginalAlignment(item) {
  return Boolean(item.originalAlignedText && Number(item.alignmentConfidence || 0) >= 0.8);
}

function alignedParagraphLooksComparable(item) {
  if (!hasReliableOriginalAlignment(item)) return false;
  return textOverlapRatio(item.originalAlignedText, item.currentParagraph || item.textPreview) >= 0.08;
}

function originalGenderSignal(originalText) {
  const text = normalizeForTokens(originalText);
  const feminine = /\b(she|her|hers|herself|woman|girl|lady|mother|daughter)\b/u.test(text);
  const masculine = /\b(he|him|his|himself|man|boy|lord|father|son)\b/u.test(text);

  if (feminine && !masculine) return 'feminine';
  if (masculine && !feminine) return 'masculine';
  return null;
}

function replaceFirstPronoun(text, fromRegex, to) {
  let replaced = false;
  const result = String(text || '').replace(fromRegex, (match) => {
    if (replaced) return match;
    replaced = true;
    if (match[0] === match[0]?.toUpperCase()) {
      return `${to[0].toUpperCase()}${to.slice(1)}`;
    }
    return to;
  });
  return replaced ? result : null;
}

function alignedHeuristicSuggestion(item) {
  if (!alignedParagraphLooksComparable(item)) return null;
  const current = item.currentParagraph || item.textPreview || '';
  const signal = originalGenderSignal(item.originalAlignedText);

  if (signal === 'feminine') {
    const suggested = replaceFirstPronoun(current, /\b[Ee]le\b/u, 'ela') ||
      replaceFirstPronoun(current, /\bdele\b/u, 'dela');
    if (suggested && suggested !== current) {
      return {
        suggestedAfter: suggested,
        reason: 'Original alinhado confiavel indica referencia feminina e o paragrafo atual contem pronome masculino simples; sugestao local gerada para aprovacao humana.',
        confidence: 0.68,
      };
    }
  }

  if (signal === 'masculine') {
    const suggested = replaceFirstPronoun(current, /\b[Ee]la\b/u, 'ele') ||
      replaceFirstPronoun(current, /\bdela\b/u, 'dele');
    if (suggested && suggested !== current) {
      return {
        suggestedAfter: suggested,
        reason: 'Original alinhado confiavel indica referencia masculina e o paragrafo atual contem pronome feminino simples; sugestao local gerada para aprovacao humana.',
        confidence: 0.68,
      };
    }
  }

  return null;
}

function beforeText(item) {
  return item.before || item.textPreview || null;
}

function suggestedAfter(item) {
  const aligned = alignedHeuristicSuggestion(item);
  if (aligned) return aligned.suggestedAfter;
  return canSuggestReplacement(item) ? item.after : null;
}

function suggestionStatus(item) {
  if (alignedHeuristicSuggestion(item)) return 'suggestion_available';
  if (canSuggestReplacement(item)) return 'suggestion_available';
  if (item.type === 'residual_english_review') return 'needs_human_translation';
  return 'insufficient_context';
}

function reasonForItem(item) {
  const aligned = alignedHeuristicSuggestion(item);
  if (aligned) return aligned.reason;

  if (canSuggestReplacement(item)) {
    return 'Item possui before/after preenchidos na review queue; suggestedAfter foi preservado como sugestao, mas ainda requer aprovacao humana.';
  }

  if (hasReliableOriginalAlignment(item) && !alignedParagraphLooksComparable(item)) {
    return 'Ha originalAlignedText confiavel em nivel de capitulo, mas o paragrafo original nao tem sobreposicao textual suficiente com o paragrafo atual; nenhuma sugestao explicita foi gerada.';
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
  const aligned = alignedHeuristicSuggestion(item);
  if (aligned) return aligned.confidence;

  if (canSuggestReplacement(item)) {
    return Math.min(Number(item.confidence || 0.7), 0.85);
  }
  if (hasProbablyValidPortuguesePattern(item)) {
    return 0.35;
  }
  return Math.min(Number(item.confidence || 0.5), 0.6);
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lengthRatio(a, b) {
  const left = normalizeWhitespace(a).length;
  const right = normalizeWhitespace(b).length;
  if (!left || !right) return 0;
  return right / left;
}

function extractProtectedTokens(value) {
  const text = String(value || '');
  const matches = text.match(/\b[\p{Lu}][\p{L}0-9'-]*(?:\s+[\p{Lu}][\p{L}0-9'-]*)?\b/gu) || [];
  return [...new Set(matches)]
    .filter((token) => token.length > 2)
    .slice(0, 10);
}

function preservesProtectedTokens(sourceText, suggestedText) {
  const protectedTokens = extractProtectedTokens(sourceText);
  if (!protectedTokens.length) return true;
  return protectedTokens.every((token) => suggestedText.includes(token));
}

function parseModelConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

function validateModelSuggestion(item, parsed) {
  const sourceText = item.currentParagraph || item.textPreview || item.before || '';
  const suggestedAfter = normalizeWhitespace(parsed?.suggestedAfter);
  const confidence = parseModelConfidence(parsed?.confidence);
  const risks = Array.isArray(parsed?.risks)
    ? parsed.risks.map((risk) => normalizeWhitespace(risk)).filter(Boolean).slice(0, 6)
    : [];

  if (!suggestedAfter) {
    return {
      ok: false,
      reason: 'model_suggested_after_empty',
      suggestionStatus: item.type === 'residual_english_review' ? 'needs_human_translation' : 'insufficient_context',
    };
  }

  if (confidence < 0.65) {
    return {
      ok: false,
      reason: 'model_confidence_below_threshold',
      suggestionStatus: item.type === 'residual_english_review' ? 'needs_human_translation' : 'insufficient_context',
    };
  }

  const ratio = lengthRatio(sourceText, suggestedAfter);
  if (ratio < 0.45 || ratio > 1.8) {
    return {
      ok: false,
      reason: `model_suggestion_length_ratio_out_of_range:${ratio.toFixed(2)}`,
      suggestionStatus: 'insufficient_context',
    };
  }

  if (!preservesProtectedTokens(sourceText, suggestedAfter)) {
    return {
      ok: false,
      reason: 'model_suggestion_does_not_preserve_protected_tokens',
      suggestionStatus: 'insufficient_context',
    };
  }

  return {
    ok: true,
    suggestedAfter,
    reason: normalizeWhitespace(parsed?.reason) || 'Sugestao gerada por modelo opcional com contexto expandido; requer aprovacao humana.',
    confidence,
    risks,
  };
}

function buildSuggestion(item, index) {
  const aligned = alignedHeuristicSuggestion(item);
  const explicitSuggestedAfter = aligned?.suggestedAfter || suggestedAfter(item);

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
    alignmentConfidence: item.alignmentConfidence ?? null,
    alignmentReason: item.alignmentReason || null,
    paragraphAlignmentConfidence: item.paragraphAlignmentConfidence ?? null,
    paragraphAlignmentReason: item.paragraphAlignmentReason || null,
    before: beforeText(item),
    suggestedAfter: explicitSuggestedAfter,
    suggestionStatus: suggestionStatus(item),
    reason: reasonForItem(item),
    confidence: confidenceForItem(item),
    requiresHumanApproval: true,
    source: 'deterministic_fallback',
    risks: [],
  };
}

function summarizeSuggestions(suggestions, modelTrace) {
  return {
    totalSuggestions: suggestions.length,
    requiresHumanApproval: suggestions.filter((item) => item.requiresHumanApproval).length,
    withSuggestedAfter: suggestions.filter((item) => item.suggestedAfter).length,
    contextEnriched: suggestions.filter((item) => item.currentParagraph || item.previousParagraph || item.nextParagraph || item.originalAlignedText).length,
    reliableOriginalAlignment: suggestions.filter((item) => item.originalAlignedText && Number(item.alignmentConfidence || 0) >= 0.8).length,
    originalAlignmentSkipped: suggestions.filter((item) => !item.originalAlignedText).length,
    reliableParagraphAlignment: suggestions.filter((item) => item.originalAlignedText && Number(item.paragraphAlignmentConfidence || 0) >= 0.72).length,
    paragraphAlignmentSkipped: suggestions.filter((item) => !item.originalAlignedText).length,
    suggestionAvailable: suggestions.filter((item) => item.suggestionStatus === 'suggestion_available').length,
    needsHumanTranslation: suggestions.filter((item) => item.suggestionStatus === 'needs_human_translation').length,
    insufficientContext: suggestions.filter((item) => item.suggestionStatus === 'insufficient_context').length,
    deterministicFallback: suggestions.filter((item) => item.source === 'deterministic_fallback').length,
    ollamaSuggestions: suggestions.filter((item) => item.source === 'ollama').length,
    modelAccepted: modelTrace?.summary?.accepted || 0,
    modelRejected: modelTrace?.summary?.rejected || 0,
    modelFailed: modelTrace?.summary?.failed || 0,
    modelFallback: modelTrace?.summary?.fallback || 0,
    modelEnabled: Boolean(modelTrace?.adapter?.enabled),
    modelName: modelTrace?.adapter?.model || null,
  };
}

export async function buildAssistedReviewSuggestions({
  reviewQueue,
  createdAt = new Date().toISOString(),
  modelAdapter = null,
} = {}) {
  const sourceItems = (reviewQueue?.items || [])
    .filter((item) => item.status === 'pending' && item.mode === 'auto_review');
  const modelTrace = createModelTrace({ createdAt, adapter: modelAdapter });
  const suggestions = [];

  for (const item of sourceItems) {
    const deterministic = buildSuggestion(item, suggestions.length);
    let finalSuggestion = deterministic;

    if (modelAdapter?.enabled) {
      const modelResult = await modelAdapter.suggest(item);
      if (modelResult.ok) {
        const validation = validateModelSuggestion(item, modelResult.parsed);
        if (validation.ok) {
          finalSuggestion = {
            ...deterministic,
            suggestedAfter: validation.suggestedAfter,
            suggestionStatus: 'suggestion_available',
            reason: validation.reason,
            confidence: validation.confidence,
            requiresHumanApproval: true,
            source: 'ollama',
            model: modelResult.model || null,
            risks: validation.risks,
          };
          appendModelTraceItem(modelTrace, {
            reviewQueueItemId: item.id,
            status: 'accepted',
            endpoint: modelResult.endpoint || null,
            model: modelResult.model || null,
            httpStatus: modelResult.httpStatus || null,
            httpStatusText: modelResult.httpStatusText || null,
            prompt: modelResult.prompt,
            rawResponse: modelResult.rawResponse,
            parsedResponse: modelResult.parsed,
            finalSuggestionId: finalSuggestion.id,
            reason: validation.reason,
            confidence: validation.confidence,
            usedFallback: false,
          });
        } else {
          finalSuggestion = {
            ...deterministic,
            suggestionStatus: validation.suggestionStatus || deterministic.suggestionStatus,
          };
          appendModelTraceItem(modelTrace, {
            reviewQueueItemId: item.id,
            status: 'rejected',
            endpoint: modelResult.endpoint || null,
            model: modelResult.model || null,
            httpStatus: modelResult.httpStatus || null,
            httpStatusText: modelResult.httpStatusText || null,
            prompt: modelResult.prompt,
            rawResponse: modelResult.rawResponse,
            parsedResponse: modelResult.parsed,
            rejectionReason: validation.reason,
            usedFallback: true,
          });
        }
      } else {
        appendModelTraceItem(modelTrace, {
          reviewQueueItemId: item.id,
          status: 'failed',
          endpoint: modelResult.endpoint || null,
          model: modelResult.model || null,
          httpStatus: modelResult.httpStatus || null,
          httpStatusText: modelResult.httpStatusText || null,
          prompt: modelResult.prompt || null,
          error: modelResult.error || modelResult.reason || 'model_failed',
          errorDetails: modelResult.errorDetails || null,
          usedFallback: true,
        });
      }
    }

    suggestions.push(finalSuggestion);
  }

  const assistedReview = {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    modelAssistance: {
      enabled: Boolean(modelAdapter?.enabled),
      provider: modelAdapter?.provider || modelAdapter?.name || 'none',
      model: modelAdapter?.model || null,
      traceFile: 'logs/json/assisted-review-model-trace.json',
      requiresHumanApproval: true,
    },
    source: {
      reviewQueueCreatedAt: reviewQueue?.createdAt || null,
    },
    summary: summarizeSuggestions(suggestions, modelTrace),
    suggestions,
  };

  return {
    assistedReview,
    modelTrace,
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
    `Alinhamento original confiavel: ${summary.reliableOriginalAlignment || 0}`,
    `Sem originalAlignedText por seguranca: ${summary.originalAlignmentSkipped || 0}`,
    `Alinhamento de paragrafo confiavel: ${summary.reliableParagraphAlignment || 0}`,
    `Sem alinhamento de paragrafo por seguranca: ${summary.paragraphAlignmentSkipped || 0}`,
    `Suggestion available: ${summary.suggestionAvailable || 0}`,
    `Needs human translation: ${summary.needsHumanTranslation || 0}`,
    `Insufficient context: ${summary.insufficientContext || 0}`,
    `Fallback deterministico: ${summary.deterministicFallback || 0}`,
    `Sugestoes Ollama: ${summary.ollamaSuggestions || 0}`,
    `Modelo aceitas/rejeitadas/falhas: ${summary.modelAccepted || 0}/${summary.modelRejected || 0}/${summary.modelFailed || 0}`,
    '',
    'Nenhuma sugestao deste arquivo e aplicada automaticamente.',
    '',
    '| ID | Review item | Status | Origem | Tipo | Arquivo | Node | Confidence | Alignment | Before | Suggested after | Riscos | Contexto | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(suggestions.length
      ? suggestions.map((item) => [
        item.id,
        item.reviewQueueItemId || '-',
        item.suggestionStatus || '-',
        item.source || '-',
        item.type || '-',
        item.filePath || '-',
        item.nodeId || '-',
        item.confidence ?? '-',
        `${item.alignmentReason || '-'} (${item.alignmentConfidence ?? '-'}) / ${item.paragraphAlignmentReason || '-'} (${item.paragraphAlignmentConfidence ?? '-'})`,
        String(item.before || '-').replace(/\s+/g, ' ').slice(0, 180),
        String(item.suggestedAfter || '-').replace(/\s+/g, ' ').slice(0, 180),
        Array.isArray(item.risks) && item.risks.length ? item.risks.join('; ') : '-',
        String(item.currentParagraph || item.textPreview || '-').replace(/\s+/g, ' ').slice(0, 180),
        item.reason || '-',
      ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ')).map((row) => `| ${row} |`)
      : ['| - | - | - | - | - | - | - | Nenhuma sugestao gerada | - | - | - | - | - |']),
    '',
  ].join('\n');
}
