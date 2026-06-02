import { escapeHtml } from './htmlUtils.js';
import { decisionOptionsForItem, replacementForDecision } from './reviewDecision.js';
import { stableKeyFromFinding, stableReviewId } from './reviewQueueKeys.js';

function itemFromFinding(category, finding) {
  return {
    id: stableReviewId(stableKeyFromFinding(category, finding)),
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
  const item = itemFromFinding(category, finding);
  const options = decisionOptionsForItem(item).filter((option) => ['keep', 'apply'].includes(option.action));
  return `
    <div class="decision-panel"
      data-review-id="${escapeHtml(item.id)}"
      data-category-id="${escapeHtml(item.categoryId)}"
      data-chapter="${escapeHtml(item.chapter)}"
      data-type="${escapeHtml(item.type)}"
      data-term="${escapeHtml(item.problematicTerm || item.original || '')}">
      <strong>Decisão</strong>
      <div class="decision-actions">${options.map((option) => buttonForOption(item, option)).join('')}</div>
      <label class="manual-decision">
        <span>Editar manualmente</span>
        <input type="text" placeholder="Informe a correção" data-manual-input="${escapeHtml(item.id)}">
        <button type="button" class="decision-btn manual-confirm" data-action="manual" data-id="${escapeHtml(item.id)}">Confirmar</button>
      </label>
      <small class="decision-status" data-decision-status="${escapeHtml(item.id)}">Sem decisão</small>
    </div>`;
}
