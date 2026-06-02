import { escapeHtml, formatNumber, highlightTerm, safeId } from './htmlUtils.js';
import { renderDecisionControls } from './reportDecisionControls.js';

function displayedFindings(category) {
  const findings = category?.findings || [];
  const limit = Number(category?.displayLimit || category?.shown || findings.length);
  return findings.slice(0, limit);
}

function renderLimitNotice(category) {
  const count = Number(category?.count || 0);
  const shown = Math.min(displayedFindings(category).length, count);
  if (count <= shown) return '';
  return `
    <div class="limit-notice">
      Exibindo ${formatNumber(shown)} de ${formatNumber(count)} achados nesta aba. A lista completa fica nos detalhes do relatório.
    </div>`;
}

function renderEmptyRow() {
  return '<tr><td colspan="5" class="empty-cell">Nenhum achado nesta categoria.</td></tr>';
}

function impactLabel(severity) {
  return {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  }[severity] || severity || '-';
}

function originalTerm(finding) {
  return finding.problematicTerm || finding.original || '-';
}

function translationContext(finding) {
  return finding.location || finding.translation || '-';
}

function renderRows(category) {
  const findings = displayedFindings(category);
  if (!findings.length) return renderEmptyRow();
  return findings.map((finding) => `
    <tr>
      <td class="impact-col"><span class="impact impact-${escapeHtml(finding.severity || 'medium')}">${escapeHtml(impactLabel(finding.severity))}</span></td>
      <td class="chapter-type-col">
        <strong>Capítulo ${escapeHtml(finding.chapter || '-')}</strong>
        <small>${escapeHtml(finding.type || '-')}</small>
      </td>
      <td class="term-col"><code>${escapeHtml(originalTerm(finding))}</code></td>
      <td class="context-col"><blockquote>${highlightTerm(translationContext(finding), finding.problematicTerm)}</blockquote></td>
      <td class="analysis-col">
        <div class="analysis-box problem-box"><strong>Problema</strong><span>${escapeHtml(finding.problem || '-')}</span></div>
        <div class="analysis-box suggestion-box"><strong>Sugestão</strong><span>${escapeHtml(finding.recommendation || '-')}</span></div>
        ${renderDecisionControls(category, finding)}
      </td>
    </tr>
  `).join('');
}

export function renderPane(category, index) {
  const id = `tab-${safeId(category.id || index)}`;
  return `
    <section id="${id}" class="tab-pane${index === 0 ? ' active-pane' : ''}" role="tabpanel">
      <div class="table-wrapper">
        <table class="data-table" aria-label="${escapeHtml(category.description || category.label || '')}">
          <colgroup>
            <col class="col-impact">
            <col class="col-chapter-type">
            <col class="col-term">
            <col class="col-context">
            <col class="col-analysis">
          </colgroup>
          <thead>
            <tr>
              <th>Impacto</th>
              <th>Cap. / Tipo</th>
              <th>Termo original</th>
              <th>Traducao e contexto</th>
              <th>Analise tecnica</th>
            </tr>
          </thead>
          <tbody>${renderRows(category)}</tbody>
        </table>
      </div>
      <div class="note"><strong>Nota:</strong> estes achados exigem validacao humana antes de qualquer correcao.</div>
      ${renderLimitNotice(category)}
    </section>`;
}

export function renderTabs(categories) {
  return `
    <nav class="tabs" role="tablist" aria-label="Categorias do relatorio">
      ${categories.map((category, index) => {
        const id = `tab-${safeId(category.id || index)}`;
        return `<button class="tab-btn${index === 0 ? ' active' : ''}" type="button" data-tab="${id}" aria-selected="${index === 0 ? 'true' : 'false'}">${escapeHtml(category.label)} <span>${formatNumber(category.count)}</span></button>`;
      }).join('')}
    </nav>`;
}
