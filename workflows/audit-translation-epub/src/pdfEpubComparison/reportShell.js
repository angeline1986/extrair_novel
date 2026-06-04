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
      function switchTab(targetId) {
        buttons.forEach((button) => {
          const active = button.dataset.tab === targetId;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panes.forEach((pane) => pane.classList.toggle('active-pane', pane.id === targetId));
        localStorage.setItem('pdfEpubComparisonActiveTab', targetId);
      }
      buttons.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
      const saved = localStorage.getItem('pdfEpubComparisonActiveTab');
      if (saved && document.getElementById(saved)) switchTab(saved);
    })();
  `;
}

export function buildPdfEpubComparisonHtml(audit) {
  const categories = audit?.categories || [];
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
    <header>
      <h1>Analise PDF x EPUB</h1>
      <p>Comparacao editorial entre o PDF original e o EPUB traduzido/validado.</p>
    </header>
    ${renderReportDetails(audit)}
    ${renderTabs(categories)}
    <div class="tab-content">${categories.map(renderPane).join('')}</div>
    <footer>Gerado em ${escapeHtml(generatedAt)}. Nenhuma correcao automatica foi aplicada.</footer>
  </main>
  <script>${reportScript()}</script>
  <script>${reportInteractionScript(audit)}</script>
</body>
</html>`;
}
