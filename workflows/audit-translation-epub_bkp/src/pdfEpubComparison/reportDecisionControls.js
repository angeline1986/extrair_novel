import { escapeHtml } from './htmlUtils.js';
import { decisionOptionsForItem, replacementForDecision } from './reviewDecision.js';
import { stableKeyFromFinding, stableReviewId } from './reviewQueueKeys.js';

function itemFromFinding(category, finding) {
  return {
    id: finding.reviewId || stableReviewId(stableKeyFromFinding(category, finding)),
    categoryId: category.id,
    categoryLabel: category.label,
    type: finding.type || category.label,
    chapter: finding.chapter || '-',
    original: finding.original || '',
    translation: finding.translation || '',
    recommendation: finding.recommendation || '',
    location: finding.location || '',
    problematicTerm: finding.problematicTerm || '',
    sourceTerm: finding.original || '',
    context: finding.occurrenceContext || finding.location || finding.translation || '',
    occurrenceIndex: Number.isInteger(finding.occurrenceIndex) ? finding.occurrenceIndex : null,
    occurrenceNumber: Number.isInteger(finding.occurrenceNumber) ? finding.occurrenceNumber : null,
    decisionSuggestion: finding.decisionSuggestion || null,
  };
}

function termsForDecision(finding) {
  if (Array.isArray(finding.decisionTerms) && finding.decisionTerms.length) {
    return finding.decisionTerms;
  }
  const value = String(finding.problematicTerm || '').trim();
  const terms = value
    .split(/\s*\/\s*/)
    .map((term) => term.trim())
    .filter(Boolean);
  return terms.length > 1 ? terms : [value || finding.original || ''];
}

function decisionOccurrences(finding) {
  const terms = termsForDecision(finding);
  const context = String(finding.location || finding.translation || '');
  const escapedTerms = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  if (!context || !escapedTerms.length) {
    return terms.map((term, index) => ({ term, occurrenceIndex: 0, occurrenceNumber: index + 1 }));
  }

  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedTerms.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  const counts = new Map();
  const occurrences = [];
  for (const match of context.matchAll(regex)) {
    const term = match[2];
    const key = term.toLocaleLowerCase('pt-BR');
    const occurrenceIndex = counts.get(key) || 0;
    counts.set(key, occurrenceIndex + 1);
    occurrences.push({ term, occurrenceIndex });
  }
  return occurrences.map((occurrence) => ({
    ...occurrence,
    occurrenceNumber: occurrence.occurrenceIndex + 1,
    totalForTerm: counts.get(occurrence.term.toLocaleLowerCase('pt-BR')) || 1,
  }));
}

function itemForOccurrence(category, finding, occurrence) {
  const term = occurrence.term;
  const suggestion = (finding.decisionSuggestions || []).find((item) =>
    String(item.term || '').toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')
  );
  const useLegacyId = term === finding.problematicTerm && occurrence.occurrenceIndex === 0;
  if (useLegacyId) {
    return itemFromFinding(category, {
      ...finding,
      occurrenceContext: finding.location || finding.translation || '',
      occurrenceIndex: occurrence.occurrenceIndex,
      occurrenceNumber: occurrence.occurrenceNumber,
      decisionSuggestion: suggestion,
    });
  }
  const { reviewId, stableKey, dedupeKey, ...termFinding } = finding;
  return itemFromFinding(category, {
    ...termFinding,
    problematicTerm: term,
    original: term,
    occurrenceKey: `${term.toLocaleLowerCase('pt-BR')}::${occurrence.occurrenceIndex}`,
    occurrenceContext: finding.location || finding.translation || '',
    occurrenceIndex: occurrence.occurrenceIndex,
    occurrenceNumber: occurrence.occurrenceNumber,
    decisionSuggestion: suggestion,
  });
}

function buttonForOption(item, option) {
  const replacement = option.action === 'apply' ? replacementForDecision(item, option.replacement) : null;
  return `
    <button type="button"
      class="decision-btn"
      data-action="${escapeHtml(option.action)}"
      data-id="${escapeHtml(item.id)}"
      data-label="${escapeHtml(option.label)}"
      data-from="${escapeHtml(replacement?.from || '')}"
      data-to="${escapeHtml(replacement?.to || '')}">
      ${escapeHtml(option.label)}
    </button>`;
}

export function reviewIdForFinding(category, finding) {
  return itemFromFinding(category, finding).id;
}

export function renderDecisionControls(category, finding) {
  return decisionOccurrences(finding)
    .map((occurrence) => renderDecisionPanel(
      itemForOccurrence(category, finding, occurrence),
      occurrence.term,
      occurrence.totalForTerm
    ))
    .join('');
}

function renderDecisionPanel(item, term, totalForTerm = 1) {
  const options = decisionOptionsForItem(item).filter((option) => ['keep', 'apply'].includes(option.action));
  const occurrenceLabel = totalForTerm > 1 ? ` (${item.occurrenceNumber}ª ocorrência)` : '';
  return `
    <div class="decision-panel"
      data-review-id="${escapeHtml(item.id)}"
      data-category-id="${escapeHtml(item.categoryId)}"
      data-chapter="${escapeHtml(item.chapter)}"
      data-type="${escapeHtml(item.type)}"
      data-term="${escapeHtml(item.problematicTerm || item.original || '')}"
      data-context="${escapeHtml(item.context)}"
      data-occurrence-index="${escapeHtml(item.occurrenceIndex ?? '')}"
      data-suggested-decision="${escapeHtml(item.decisionSuggestion?.decision || '')}"
      data-suggestion-confidence="${escapeHtml(item.decisionSuggestion?.confidence || '')}"
      data-suggestion-source="${escapeHtml(item.decisionSuggestion?.source || '')}">
      <strong>Decisão${term ? `: ${escapeHtml(term)}${escapeHtml(occurrenceLabel)}` : ''}</strong>
      <div class="decision-actions">${options.map((option) => buttonForOption(item, option)).join('')}</div>
      <label class="manual-decision">
        <span>Editar manualmente</span>
        <input type="text" placeholder="Informe a correção" data-manual-input="${escapeHtml(item.id)}">
        <button type="button" class="decision-btn manual-confirm" data-action="manual" data-id="${escapeHtml(item.id)}">Confirmar</button>
      </label>
      <small class="decision-status" data-decision-status="${escapeHtml(item.id)}">Sem decisão</small>
      ${item.decisionSuggestion ? `
        <small class="decision-suggestion">
          Sugestão ${escapeHtml(item.decisionSuggestion.confidence)}:
          ${item.decisionSuggestion.decision === 'apply' ? 'corrigir' : 'manter'}
          (${escapeHtml(item.decisionSuggestion.source.startsWith('english_') ? 'apoio EN' : 'contexto PT')})
        </small>` : ''}
      <button type="button" class="clear-line-decision" data-clear-decision="${escapeHtml(item.id)}">Limpar decisão</button>
    </div>`;
}
