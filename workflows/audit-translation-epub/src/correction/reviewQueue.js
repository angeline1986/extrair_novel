const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'needs_context']);
const CONTEXT_PREVIEW_LIMIT = 520;

function reviewItemId(index) {
  return `rq-${String(index + 1).padStart(4, '0')}`;
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

function chapterNumberFromSection(section) {
  const value = `${section?.title || ''} ${section?.path || ''}`;
  const match = value.match(/(?:chapter|cap[ií]tulo|text\/)(?:_|\s|-)*0*(\d{1,4})/i) ||
    value.match(/\/0*(\d{1,4})[_-]/);
  return match ? Number(match[1]) : null;
}

function findOriginalAlignedText({ sourceDoc, translationDoc, location }) {
  if (!sourceDoc || !translationDoc || !location?.filePath) return null;
  const translationSection = (translationDoc.sections || []).find((section) => section.path === location.filePath);
  if (!translationSection) return null;
  const translationChapter = chapterNumberFromSection(translationSection);
  const sourceSection = (sourceDoc.sections || []).find((section) =>
    translationChapter !== null && chapterNumberFromSection(section) === translationChapter);
  if (!sourceSection) return null;

  return preview(
    sourceSection.paragraphs?.[location.paragraphIndex] ||
    sourceSection.rawText ||
    null
  );
}

function contextForAction(action, { xhtmlMap, sourceDoc, translationDoc } = {}) {
  const location = firstLocation(action);
  const mapped = findMappedParagraph(xhtmlMap, location);
  const currentParagraph = preview(mapped?.paragraph?.text || location.textPreview);

  return {
    previousParagraph: preview(mapped?.previous?.text),
    currentParagraph,
    nextParagraph: preview(mapped?.next?.text),
    originalAlignedText: findOriginalAlignedText({ sourceDoc, translationDoc, location }),
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

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length;
}

export function buildReviewQueue({
  correctionPlan,
  existingQueue = null,
  xhtmlMap = null,
  sourceDoc = null,
  translationDoc = null,
  createdAt = new Date().toISOString(),
}) {
  const previousItems = previousItemByKey(existingQueue);
  const reviewActions = (correctionPlan?.actions || []).filter(actionNeedsReview);
  const items = reviewActions.map((action, index) => {
    const location = firstLocation(action);
    const stableKey = stableKeyFromAction(action);
    const previousItem = previousItems.get(stableKey) || {};
    const previousStatus = REVIEW_STATUSES.has(previousItem.status) ? previousItem.status : 'pending';
    const context = contextForAction(action, { xhtmlMap, sourceDoc, translationDoc });

    return {
      id: reviewItemId(index),
      stableKey,
      actionId: action.id,
      candidateId: action.candidateId,
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

  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    source: correctionPlan?.source || {},
    summary: {
      totalItems: items.length,
      autoReview: items.filter((item) => item.mode === 'auto_review').length,
      manualOnly: items.filter((item) => item.mode === 'manual_only').length,
      contextEnriched: items.filter((item) => item.currentParagraph || item.previousParagraph || item.nextParagraph || item.originalAlignedText).length,
      pending: countByStatus(items, 'pending'),
      approved: countByStatus(items, 'approved'),
      rejected: countByStatus(items, 'rejected'),
      needsContext: countByStatus(items, 'needs_context'),
    },
    allowedStatuses: ['pending', 'approved', 'rejected', 'needs_context'],
    items,
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
    `Pending: ${summary.pending || 0}`,
    `Approved: ${summary.approved || 0}`,
    `Rejected: ${summary.rejected || 0}`,
    `Needs context: ${summary.needsContext || 0}`,
    '',
    '## Itens',
    '',
    '| ID | Status | Tipo | Modo | Arquivo | Node | Confidence | Motivo | Sugestao | Preview |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(items.length
      ? items.map((item) => [
        item.id,
        item.status,
        item.type || '-',
        item.mode || '-',
        item.filePath || '-',
        item.nodeId || '-',
        item.confidence ?? '-',
        item.notAppliedReason || item.reason || '-',
        item.suggestion || '-',
        String(item.textPreview || '-').replace(/\s+/g, ' ').slice(0, 180),
      ].map((value) => String(value).replaceAll('|', '\\|')).join(' | ')).map((row) => `| ${row} |`)
      : ['| - | pending | - | - | - | - | - | Nenhum item pendente | - | - |']),
    '',
  ].join('\n');
}
