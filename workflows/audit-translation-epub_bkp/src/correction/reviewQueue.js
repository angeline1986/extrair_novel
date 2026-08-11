import { alignedOriginalParagraphByText } from '../chapterAligner.js';

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'needs_context']);
const CONTEXT_PREVIEW_LIMIT = 520;

function stableReviewId(stableKey) {
  let hash = 5381;
  for (const char of String(stableKey || 'review-item')) {
    hash = ((hash << 5) + hash) + char.charCodeAt(0);
    hash >>>= 0;
  }
  return `id${String(hash % 100000).padStart(5, '0')}`;
}

function actionNeedsReview(action) {
  return action?.mode === 'auto_review' || action?.mode === 'manual_only';
}

function firstLocation(action) {
  const locations = Array.isArray(action?.locations) ? action.locations : [];
  return locations[0] || action?.target || {};
}

function preview(value, limit = CONTEXT_PREVIEW_LIMIT) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function findMappedParagraph(xhtmlMap, location) {
  if (!xhtmlMap || !location?.filePath || !Number.isInteger(location.paragraphIndex)) return null;
  const file = (xhtmlMap.files || []).find((item) => item.filePath === location.filePath);
  if (!file) return null;
  return {
    file,
    paragraph: file.paragraphs?.[location.paragraphIndex] || null,
    previous: file.paragraphs?.[location.paragraphIndex - 1] || null,
    next: file.paragraphs?.[location.paragraphIndex + 1] || null,
  };
}

function alignedOriginalContext({ sourceDoc, chapterAlignment, location, currentParagraph }) {
  const result = alignedOriginalParagraphByText({
    sourceDoc,
    chapterAlignment,
    translationPath: location?.filePath,
    paragraphIndex: location?.paragraphIndex,
    translatedParagraph: currentParagraph,
  });

  return {
    originalAlignedText: preview(result.text),
    alignmentConfidence: result.confidence,
    alignmentReason: result.reason,
    paragraphAlignmentConfidence: result.paragraphAlignmentConfidence,
    paragraphAlignmentReason: result.paragraphAlignmentReason,
  };
}

function contextForAction(action, { xhtmlMap, sourceDoc, chapterAlignment } = {}) {
  const location = firstLocation(action);
  const mapped = findMappedParagraph(xhtmlMap, location);
  const currentParagraph = preview(mapped?.paragraph?.text || location.textPreview);
  const originalContext = alignedOriginalContext({ sourceDoc, chapterAlignment, location, currentParagraph });

  return {
    previousParagraph: preview(mapped?.previous?.text),
    currentParagraph,
    nextParagraph: preview(mapped?.next?.text),
    ...originalContext,
  };
}

function stableKeyFromAction(action) {
  const location = firstLocation(action);
  return [
    action?.type || '-',
    action?.mode || '-',
    location.filePath || action?.target?.filePath || '-',
    location.id || '-',
    location.textPreview || action?.target?.textPreview || '-',
    action?.reason || '-',
  ].join('::');
}

function previousItemByKey(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    if (!item.stableKey) continue;
    map.set(item.stableKey, item);
  }
  return map;
}

function reviewSignatureFromParts({ type, before, after, filePath, nodeId }) {
  return [
    type || '-',
    before || '-',
    after || '-',
    filePath || '-',
    nodeId || '-',
  ].join('::');
}

function reviewSignatureFromItem(item) {
  return reviewSignatureFromParts({
    type: item?.type,
    before: item?.before,
    after: item?.after,
    filePath: item?.filePath,
    nodeId: item?.nodeId,
  });
}

function reviewSignatureFromAction(action) {
  const location = firstLocation(action);
  return reviewSignatureFromParts({
    type: action?.type,
    before: action?.before,
    after: action?.after,
    filePath: location.filePath || action?.target?.filePath,
    nodeId: location.id,
  });
}

function previousItemByReviewSignature(existingQueue) {
  const map = new Map();
  for (const item of existingQueue?.items || []) {
    const signature = reviewSignatureFromItem(item);
    if (!signature) continue;
    map.set(signature, item);
  }
  return map;
}

function notAppliedReason(action) {
  if (action.mode === 'auto_review') return 'mode_auto_review_requires_manual_approval';
  if (action.mode === 'manual_only') return 'mode_manual_only_not_safe_for_auto_application';
  return 'mode_not_reviewable';
}

function suggestionForAction(action) {
  if (action.before && action.after) {
    return `Avaliar substituicao: ${action.before} -> ${action.after}`;
  }
  if (action.details?.note) return action.details.note;
  if (action.type === 'gender_agreement_review') return 'Revisar concordancia de genero no trecho antes de aprovar.';
  if (action.type === 'residual_english_review') return 'Confirmar se o trecho em ingles deve permanecer ou ser traduzido.';
  if (action.type === 'structural_manual_review') return 'Revisar estrutura do EPUB manualmente antes de qualquer correcao.';
  return 'Revisar contexto e decidir se a correcao deve ser aprovada, rejeitada ou marcada como needs_context.';
}

function semanticCandidateEligible(candidate) {
  return Boolean(
    candidate?.severity === 'medium' &&
    Number(candidate.confidenceScore || 0) >= 0.55
  );
}

function stableKeyFromSemanticCandidate(candidate) {
  return [
    'semantic_audit',
    candidate?.type || '-',
    candidate?.location?.filePath || '-',
    candidate?.location?.nodeId || '-',
    candidate?.reason || '-',
  ].join('::');
}

function semanticSuggestion(candidate) {
  if (candidate.type === 'semantic_terminology_inconsistency') {
    return `Revisar terminologia: ${candidate.evidence?.from || '-'} -> ${candidate.evidence?.expected || '-'}`;
  }
  if (candidate.type === 'semantic_treatment_inconsistency') {
    return 'Revisar consistencia de tratamento/personagem no contexto antes de aprovar qualquer ajuste.';
  }
  if (candidate.type === 'semantic_repetition_anomaly') {
    return 'Verificar se a repeticao e enfase intencional ou erro textual.';
  }
  return 'Revisar achado semantico com apoio do contexto antes de qualquer aprovacao manual.';
}

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length;
}

export function buildReviewQueue({
  correctionPlan,
  semanticAudit = null,
  existingQueue = null,
  xhtmlMap = null,
  sourceDoc = null,
  chapterAlignment = null,
  createdAt = new Date().toISOString(),
}) {
  const previousItems = previousItemByKey(existingQueue);
  const previousItemsBySignature = previousItemByReviewSignature(existingQueue);
  const reviewActions = (correctionPlan?.actions || []).filter(actionNeedsReview);
  const items = reviewActions.map((action, index) => {
    const location = firstLocation(action);
    const stableKey = stableKeyFromAction(action);
    const previousItem = previousItems.get(stableKey) || previousItemsBySignature.get(reviewSignatureFromAction(action)) || {};
    const previousStatus = REVIEW_STATUSES.has(previousItem.status) ? previousItem.status : 'pending';
    const context = contextForAction(action, { xhtmlMap, sourceDoc, chapterAlignment });

    return {
      id: stableReviewId(stableKey),
      stableKey,
      actionId: action.id,
      candidateId: action.candidateId,
      origin: 'correction_plan',
      type: action.type,
      mode: action.mode,
      status: previousStatus,
      filePath: location.filePath || action.target?.filePath || null,
      nodeId: location.id || null,
      spineIndex: location.spineIndex ?? action.target?.spineIndex ?? null,
      paragraphIndex: location.paragraphIndex ?? action.target?.paragraphIndex ?? null,
      textNodeIndex: location.textNodeIndex ?? action.target?.textNodeIndex ?? null,
      textPreview: location.textPreview || action.target?.textPreview || null,
      previousParagraph: context.previousParagraph,
      currentParagraph: context.currentParagraph,
      nextParagraph: context.nextParagraph,
      originalAlignedText: context.originalAlignedText,
      alignmentConfidence: context.alignmentConfidence,
      alignmentReason: context.alignmentReason,
      paragraphAlignmentConfidence: context.paragraphAlignmentConfidence,
      paragraphAlignmentReason: context.paragraphAlignmentReason,
      reason: action.reason || null,
      notAppliedReason: notAppliedReason(action),
      confidence: action.confidence ?? null,
      risk: action.risk || null,
      suggestion: suggestionForAction(action),
      before: previousItem.before || action.before || null,
      after: previousItem.after || action.after || null,
      occurrences: action.occurrences || null,
      examples: action.examples || null,
      details: action.details || null,
      review: previousItem.review || {
        approvedBy: null,
        reviewedAt: null,
        notes: null,
      },
    };
  });
  const semanticCandidates = (semanticAudit?.semanticCandidates || []).filter(semanticCandidateEligible);
  const semanticItems = semanticCandidates.map((candidate) => {
    const stableKey = stableKeyFromSemanticCandidate(candidate);
    const previousItem = previousItems.get(stableKey) || {};
    const previousStatus = REVIEW_STATUSES.has(previousItem.status) ? previousItem.status : 'pending';

    return {
      id: stableReviewId(stableKey),
      stableKey,
      actionId: null,
      candidateId: candidate.id,
      semanticCandidateId: candidate.id,
      origin: 'semantic_audit',
      type: candidate.type,
      mode: 'auto_review',
      status: previousStatus,
      severity: candidate.severity,
      filePath: candidate.location?.filePath || null,
      nodeId: candidate.location?.nodeId || null,
      spineIndex: candidate.location?.spineIndex ?? null,
      paragraphIndex: candidate.location?.paragraphIndex ?? null,
      textNodeIndex: candidate.location?.textNodeIndex ?? null,
      textPreview: candidate.location?.textPreview || null,
      previousParagraph: candidate.context?.previousParagraph || null,
      currentParagraph: candidate.context?.currentParagraph || null,
      nextParagraph: candidate.context?.nextParagraph || null,
      originalAlignedText: candidate.context?.originalAlignedText || null,
      alignmentConfidence: candidate.context?.alignmentConfidence ?? null,
      alignmentReason: candidate.context?.alignmentReason || null,
      paragraphAlignmentConfidence: candidate.context?.paragraphAlignmentConfidence ?? null,
      paragraphAlignmentReason: candidate.context?.paragraphAlignmentReason || null,
      reason: candidate.reason || null,
      notAppliedReason: 'semantic_audit_requires_manual_approval',
      confidence: candidate.confidenceScore ?? null,
      confidenceKind: candidate.confidence || null,
      risk: candidate.severity || null,
      suggestion: semanticSuggestion(candidate),
      before: previousItem.before || null,
      after: previousItem.after || null,
      occurrences: null,
      examples: null,
      details: {
        semanticCandidateId: candidate.id,
        semanticSeverity: candidate.severity,
        semanticConfidence: candidate.confidence,
        evidence: candidate.evidence || null,
        feedsCorrectionPlan: false,
        requiresHumanApproval: true,
      },
      review: previousItem.review || {
        approvedBy: null,
        reviewedAt: null,
        notes: null,
      },
    };
  });
  const allItems = [...items, ...semanticItems];

  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    source: correctionPlan?.source || {},
    summary: {
      totalItems: allItems.length,
      correctionPlanItems: items.length,
      semanticAuditItems: semanticItems.length,
      autoReview: allItems.filter((item) => item.mode === 'auto_review').length,
      manualOnly: allItems.filter((item) => item.mode === 'manual_only').length,
      contextEnriched: allItems.filter((item) => item.currentParagraph || item.previousParagraph || item.nextParagraph || item.originalAlignedText).length,
      reliableOriginalAlignment: allItems.filter((item) => item.originalAlignedText && Number(item.alignmentConfidence || 0) >= 0.8).length,
      originalAlignmentSkipped: allItems.filter((item) => !item.originalAlignedText).length,
      reliableParagraphAlignment: allItems.filter((item) => item.originalAlignedText && Number(item.paragraphAlignmentConfidence || 0) >= 0.72).length,
      paragraphAlignmentSkipped: allItems.filter((item) => !item.originalAlignedText).length,
      pending: countByStatus(allItems, 'pending'),
      approved: countByStatus(allItems, 'approved'),
      rejected: countByStatus(allItems, 'rejected'),
      needsContext: countByStatus(allItems, 'needs_context'),
    },
    allowedStatuses: ['pending', 'approved', 'rejected', 'needs_context'],
    items: allItems,
  };
}

export function renderReviewQueueMarkdown(reviewQueue) {
  const items = reviewQueue?.items || [];
  const summary = reviewQueue?.summary || {};

  return [
    '# Review Queue EPUB',
    '',
    `Gerado em: ${reviewQueue?.createdAt || '-'}`,
    `Total: ${summary.totalItems || 0}`,
    `Correction plan items: ${summary.correctionPlanItems || 0}`,
    `Semantic audit items: ${summary.semanticAuditItems || 0}`,
    `Pending: ${summary.pending || 0}`,
    `Approved: ${summary.approved || 0}`,
    `Rejected: ${summary.rejected || 0}`,
    `Needs context: ${summary.needsContext || 0}`,
    `Alinhamento original confiavel: ${summary.reliableOriginalAlignment || 0}`,
    `Sem originalAlignedText por seguranca: ${summary.originalAlignmentSkipped || 0}`,
    `Alinhamento de paragrafo confiavel: ${summary.reliableParagraphAlignment || 0}`,
    `Sem alinhamento de paragrafo por seguranca: ${summary.paragraphAlignmentSkipped || 0}`,
    '',
    '## Itens',
    '',
    '| ID | Status | Origem | Tipo | Modo | Arquivo | Node | Confidence | Alignment | Motivo | Sugestao | Preview |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(items.length
      ? items.map((item) => [
        item.id,
        item.status,
        item.origin || '-',
        item.type || '-',
        item.mode || '-',
        item.filePath || '-',
        item.nodeId || '-',
        item.confidence ?? '-',
        `${item.alignmentReason || '-'} (${item.alignmentConfidence ?? '-'}) / ${item.paragraphAlignmentReason || '-'} (${item.paragraphAlignmentConfidence ?? '-'})`,
        item.notAppliedReason || item.reason || '-',
        item.suggestion || '-',
        String(item.textPreview || '-').replace(/\s+/g, ' ').slice(0, 180),
      ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ')).map((row) => `| ${row} |`)
      : ['| - | pending | - | - | - | - | - | - | - | Nenhum item pendente | - | - |']),
    '',
  ].join('\n');
}
