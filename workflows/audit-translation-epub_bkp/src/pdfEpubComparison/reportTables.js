import { escapeHtml, formatNumber, highlightTerm, safeId } from './htmlUtils.js';
import { renderDecisionControls } from './reportDecisionControls.js';

function displayedFindings(category) {
  return category?.findings || [];
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
  if (Array.isArray(finding.decisionTerms) && finding.decisionTerms.length) {
    return finding.decisionTerms.join(' / ');
  }
  return finding.problematicTerm || finding.original || '-';
}

function translationContext(finding) {
  if (finding.translation && finding.location === 'Título do capítulo') return finding.translation;
  return finding.location || finding.translation || '-';
}

function chapterTitle(finding) {
  const title = String(finding?.chapterTitle || '').trim();
  return title && title !== '-' ? title : '';
}

function renderEnglishEvidence(finding) {
  const evidence = finding?.englishEvidence;
  if (!evidence) return '';
  const statusLabel = {
    confirmed_by_english: 'Evidência EN confirmada',
    english_context_found: 'Contexto EN encontrado',
    no_english_match: 'Sem confirmação EN',
    english_chapter_unavailable: 'Capítulo EN indisponível',
    english_alignment_uncertain: 'Alinhamento EN incerto',
    english_pronouns_mixed: 'Pronomes EN mistos',
  }[evidence.status] || 'Evidência EN';
  return `
    <div class="analysis-box english-evidence-box">
      <strong>${escapeHtml(statusLabel)}</strong>
      ${evidence.text ? `<span>${escapeHtml(evidence.text)}</span>` : ''}
      <small>${escapeHtml(evidence.reason || '')}</small>
    </div>`;
}

function renderRows(category) {
  const findings = displayedFindings(category);
  if (!findings.length) return renderEmptyRow();
  return findings.map((finding) => `
    <tr class="finding-row" data-original-term="${escapeHtml(originalTerm(finding))}">
      <td class="impact-col"><span class="impact impact-${escapeHtml(finding.severity || 'medium')}">${escapeHtml(impactLabel(finding.severity))}</span></td>
      <td class="chapter-type-col">
        <strong>Capítulo ${escapeHtml(finding.chapter || '-')}</strong>
        ${chapterTitle(finding) ? `<span class="chapter-title">${escapeHtml(chapterTitle(finding))}</span>` : ''}
        <small>${escapeHtml(finding.type || '-')}</small>
      </td>
      <td class="term-col"><code>${escapeHtml(originalTerm(finding))}</code></td>
      <td class="context-col"><blockquote>${highlightTerm(translationContext(finding), finding.decisionTerms || finding.problematicTerm)}</blockquote></td>
      <td class="analysis-col">
        <div class="analysis-box problem-box"><strong>Problema</strong><span>${escapeHtml(finding.problem || '-')}</span></div>
        <div class="analysis-box suggestion-box"><strong>Sugestão</strong><span>${escapeHtml(finding.recommendation || '-')}</span></div>
        ${renderEnglishEvidence(finding)}
      </td>
    </tr>
    <tr class="decision-row">
      <td colspan="5">${renderDecisionControls(category, finding)}</td>
    </tr>
  `).join('');
}

function renderSourceLink(source) {
  if (!source) return '';
  const escaped = escapeHtml(source);
  if (/^https?:\/\//i.test(source)) {
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
  }
  return `<span>${escaped}</span>`;
}

function renderEnglishChapter(chapter) {
  const paragraphs = String(chapter.text || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const previewParagraphs = paragraphs.slice(0, 3);
  return `
    <tr class="finding-row english-source-row">
      <td class="impact-col"><span class="impact impact-low">EN</span></td>
      <td class="chapter-type-col">
        <strong>Capítulo ${escapeHtml(chapter.chapterLabel || String(chapter.chapter || '-').padStart(3, '0'))}</strong>
        <span class="chapter-title">${escapeHtml(chapter.title || '-')}</span>
        <small>${formatNumber(chapter.paragraphCount || paragraphs.length)} paragrafos</small>
      </td>
      <td class="term-col"><code>${escapeHtml(chapter.relativePath || '-')}</code></td>
      <td class="context-col">
        <blockquote>
          ${previewParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          ${paragraphs.length > previewParagraphs.length ? `
            <details class="english-full-text">
              <summary>Ver capítulo completo</summary>
              ${paragraphs.slice(previewParagraphs.length).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
            </details>` : ''}
        </blockquote>
      </td>
      <td class="analysis-col">
        <div class="analysis-box problem-box"><strong>Fonte</strong><span>${renderSourceLink(chapter.source) || '-'}</span></div>
        <div class="analysis-box suggestion-box"><strong>Uso na auditoria</strong><span>Comparar sentido, nomes e termos com a ocorrência do mesmo capítulo.</span></div>
      </td>
    </tr>`;
}

function renderEnglishSourcePane(category, index) {
  const id = `tab-${safeId(category.id || index)}`;
  const chapters = category.chapters || [];
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
              <th>Ref.</th>
              <th>Cap. / Título</th>
              <th>Arquivo</th>
              <th>Texto em inglês</th>
              <th>Apoio à auditoria</th>
            </tr>
          </thead>
          <tbody>${chapters.length ? chapters.map(renderEnglishChapter).join('') : '<tr><td colspan="5" class="empty-cell">Nenhum capítulo em inglês encontrado em input/source/english.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="note"><strong>Nota:</strong> estes capítulos são fonte auxiliar para conferência humana durante a auditoria.</div>
    </section>`;
}

export function renderPane(category, index) {
  if (category?.id === 'english_source') return renderEnglishSourcePane(category, index);
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
