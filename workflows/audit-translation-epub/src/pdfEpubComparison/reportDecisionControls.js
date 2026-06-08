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

function itemForTerm(category, finding, term) {
  if (!term || term === finding.problematicTerm) return itemFromFinding(category, finding);
  const { reviewId, stableKey, dedupeKey, ...termFinding } = finding;
  return itemFromFinding(category, {
    ...termFinding,
    problematicTerm: term,
    original: term,
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
  return termsForDecision(finding)
    .map((term) => renderDecisionPanel(itemForTerm(category, finding, term), term))
    .join('');
}

function renderDecisionPanel(item, term) {
  const options = decisionOptionsForItem(item).filter((option) => ['keep', 'apply'].includes(option.action));
  return `
    <div class="decision-panel"
      data-review-id="${escapeHtml(item.id)}"
      data-category-id="${escapeHtml(item.categoryId)}"
      data-chapter="${escapeHtml(item.chapter)}"
      data-type="${escapeHtml(item.type)}"
      data-term="${escapeHtml(item.problematicTerm || item.original || '')}">
      <strong>Decisão${term ? `: ${escapeHtml(term)}` : ''}</strong>
      <div class="decision-actions">${options.map((option) => buttonForOption(item, option)).join('')}</div>
      <label class="manual-decision">
        <span>Editar manualmente</span>
        <input type="text" placeholder="Informe a correção" data-manual-input="${escapeHtml(item.id)}">
        <button type="button" class="decision-btn manual-confirm" data-action="manual" data-id="${escapeHtml(item.id)}">Confirmar</button>
      </label>
      <small class="decision-status" data-decision-status="${escapeHtml(item.id)}">Sem decisão</small>
    </div>`;
}
