import { escapeHtml, formatNumber } from './htmlUtils.js';
import { reportInteractionScript } from './reportInteractions.js';
import { reportStyles } from './reportStyles.js';
import { renderPane, renderTabs } from './reportTables.js';

function renderReportDetails(audit) {
  const pdf = audit?.inputs?.pdf || {};
  const epub = audit?.inputs?.epub || {};
  const target = audit?.inputs?.epubTarget || {};
  return `
    <details class="report-details">
      <summary>Detalhes do relatório e arquivos analisados</summary>
      <section class="meta-grid" aria-label="Arquivos analisados">
        <div class="metric">
          <span>PDF original</span>
          <strong>${escapeHtml(pdf.filename || '-')}</strong>
          <small>${formatNumber(pdf.pageCount)} paginas · ${formatNumber(pdf.sections)} capitulos</small>
        </div>
        <div class="metric">
          <span>EPUB analisado</span>
          <strong>${escapeHtml(epub.filename || '-')}</strong>
          <small>${escapeHtml(target.source || 'desconhecido')} · ${escapeHtml(target.strategy || '-')}</small>
        </div>
        <div class="metric">
          <span>Total de achados</span>
          <strong>${formatNumber(audit?.summary?.totalFindings || 0)}</strong>
          <small>Validacao humana obrigatoria</small>
        </div>
      </section>
      <div class="details-note">
        Lista completa: <code>reports/txt/pdf-epub-comparison-full.txt</code> · JSON completo: <code>state/pdf-epub/comparison.json</code>
      </div>
      <div class="decision-export">
        <span>Decisões marcadas nesta página: <strong id="decision-count">0</strong></span>
        <button id="export-decisions" type="button">Exportar decisões</button>
        <button id="clear-decisions" type="button">Limpar decisões da página</button>
      </div>
    </details>`;
}

function reportScript() {
  return `
    (function() {
      const buttons = document.querySelectorAll('.tab-btn');
      const panes = document.querySelectorAll('.tab-pane');
      const termFilter = document.getElementById('global-term-filter');
      const termFilterCount = document.getElementById('global-term-filter-count');
      function normalize(value) {
        return String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
      }
      function activePane() {
        return [...panes].find((pane) => pane.classList.contains('active-pane'));
      }
      function applyTermFilter() {
        const pane = activePane();
        if (!pane) return;
        const needle = normalize(termFilter?.value || '');
        const findingRows = [...pane.querySelectorAll('tr.finding-row[data-original-term]')];
        let visible = 0;
        findingRows.forEach((row) => {
          const show = !needle || normalize(row.dataset.originalTerm).includes(needle);
          row.hidden = !show;
          const decisionRow = row.nextElementSibling?.classList.contains('decision-row') ? row.nextElementSibling : null;
          if (decisionRow) decisionRow.hidden = !show;
          if (show) visible += 1;
        });
        if (termFilterCount) {
          termFilterCount.textContent = needle && findingRows.length ? visible + ' ocorrência(s)' : '';
        }
      }
      function switchTab(targetId) {
        buttons.forEach((button) => {
          const active = button.dataset.tab === targetId;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panes.forEach((pane) => pane.classList.toggle('active-pane', pane.id === targetId));
        localStorage.setItem('pdfEpubComparisonActiveTab', targetId);
        applyTermFilter();
      }
      buttons.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
      termFilter?.addEventListener('input', applyTermFilter);
      const saved = localStorage.getItem('pdfEpubComparisonActiveTab');
      if (saved && document.getElementById(saved)) switchTab(saved);
      applyTermFilter();
    })();
  `;
}

export function buildPdfEpubComparisonHtml(audit) {
  const categories = audit?.categories || [];
  const englishChapters = audit?.englishSource?.chapters || [];
  const reportTabs = englishChapters.length
    ? [
        ...categories,
        {
          id: 'english_source',
          label: 'Inglês',
          description: 'Capítulos fonte em inglês para apoio da auditoria.',
          count: englishChapters.length,
          chapters: englishChapters,
        },
      ]
    : categories;
  const generatedAt = audit?.generatedAt || new Date().toISOString();
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatorio PDF x EPUB</title>
  <style>${reportStyles()}</style>
</head>
<body>
  <main class="container">
    <header class="report-header">
      <div>
        <h1>Analise PDF x EPUB</h1>
        <p>Comparacao editorial entre o PDF original e o EPUB traduzido/validado.</p>
      </div>
      <div class="term-filter">
        <label for="global-term-filter">Filtrar por termo original</label>
        <input id="global-term-filter" type="search" placeholder="Digite parte do termo original">
        <span id="global-term-filter-count" class="term-filter-count"></span>
      </div>
    </header>
    ${renderReportDetails(audit)}
    ${renderTabs(reportTabs)}
    <div class="tab-content">${reportTabs.map(renderPane).join('')}</div>
    <footer>Gerado em ${escapeHtml(generatedAt)}. Nenhuma correcao automatica foi aplicada.</footer>
  </main>
  <script>${reportScript()}</script>
  <script>${reportInteractionScript(audit)}</script>
</body>
</html>`;
}
