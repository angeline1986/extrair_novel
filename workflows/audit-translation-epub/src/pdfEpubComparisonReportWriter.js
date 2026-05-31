import fs from 'fs';
import path from 'path';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTerm(value, term) {
  const escaped = escapeHtml(value || '-');
  if (!term) return escaped;
  const pattern = new RegExp(`(${escapeRegExp(escapeHtml(term))})`, 'gi');
  return escaped.replace(pattern, '<strong>$1</strong>');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function safeId(value) {
  return String(value || 'tab')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderMeta(audit) {
  const pdf = audit?.inputs?.pdf || {};
  const epub = audit?.inputs?.epub || {};
  const target = audit?.inputs?.epubTarget || {};

  return `
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
        <small>Todos exigem validacao humana</small>
      </div>
    </section>`;
}

function renderSummary(audit) {
  const categories = audit?.categories || [];
  return `
    <section class="summary-strip" aria-label="Resumo por categoria">
      ${categories.map((category) => `
        <div>
          <span>${escapeHtml(category.label)}</span>
          <strong>${formatNumber(category.count)}</strong>
        </div>
      `).join('')}
    </section>`;
}

function renderEmptyRow(colspan) {
  return `<tr><td colspan="${colspan}" class="empty-cell">Nenhum achado nesta categoria.</td></tr>`;
}

function renderStandardRows(category) {
  const findings = category?.findings || [];
  if (!findings.length) return renderEmptyRow(7);

  return findings.map((finding) => `
    <tr>
      <td class="chapter-col">${escapeHtml(finding.chapter || '-')}</td>
      <td><strong>${escapeHtml(finding.type || '-')}</strong></td>
      <td>${escapeHtml(finding.original || '-')}</td>
      <td>${escapeHtml(finding.translation || '-')}</td>
      <td>${escapeHtml(finding.problem || '-')}</td>
      <td>${escapeHtml(finding.recommendation || '-')}</td>
      <td>${highlightTerm(finding.location || '-', finding.problematicTerm)}</td>
    </tr>
  `).join('');
}

function renderEditorialRows(category) {
  const findings = category?.findings || [];
  if (!findings.length) return renderEmptyRow(5);

  return findings.map((finding) => `
    <tr>
      <td class="chapter-col">${escapeHtml(finding.chapter || '-')}</td>
      <td><strong>${escapeHtml(finding.problematicTerm || '-')}</strong></td>
      <td>${escapeHtml(finding.sourceTerm || '-')}</td>
      <td>${escapeHtml(finding.recommended || '-')}</td>
      <td>${highlightTerm(finding.location || '-', finding.problematicTerm)}</td>
    </tr>
  `).join('');
}

function renderStandardTable(category) {
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <caption>${escapeHtml(category.description || category.label || '')}</caption>
        <thead>
          <tr>
            <th>Capitulo</th>
            <th>Tipo de problema</th>
            <th>Original PDF</th>
            <th>Traducao EPUB</th>
            <th>Problema detectado</th>
            <th>Versao corrigida / recomendacao</th>
            <th class="wide-col">Frase ou local onde ocorre o problema</th>
          </tr>
        </thead>
        <tbody>${renderStandardRows(category)}</tbody>
      </table>
    </div>`;
}

function renderEditorialTable(category) {
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <caption>${escapeHtml(category.description || category.label || '')}</caption>
        <thead>
          <tr>
            <th>Capitulo</th>
            <th>Termo problematico no EPUB</th>
            <th>Termo PDF</th>
            <th>Versao correta</th>
            <th class="wide-col">Frase ou local onde ocorre o problema</th>
          </tr>
        </thead>
        <tbody>${renderEditorialRows(category)}</tbody>
      </table>
    </div>
    <div class="note"><strong>Nota editorial:</strong> estes achados sao informativos e nao geram correcao automatica.</div>`;
}

function renderPane(category, index) {
  const id = `tab-${safeId(category.id || index)}`;
  const isEditorial = category.id === 'editorial_findings';
  return `
    <section id="${id}" class="tab-pane${index === 0 ? ' active-pane' : ''}" role="tabpanel">
      ${isEditorial ? renderEditorialTable(category) : renderStandardTable(category)}
    </section>`;
}

function renderTabs(categories) {
  return `
    <nav class="tabs" role="tablist" aria-label="Categorias do relatorio">
      ${categories.map((category, index) => {
        const id = `tab-${safeId(category.id || index)}`;
        return `<button class="tab-btn${index === 0 ? ' active' : ''}" type="button" data-tab="${id}" aria-selected="${index === 0 ? 'true' : 'false'}">${escapeHtml(category.label)} <span>${formatNumber(category.count)}</span></button>`;
      }).join('')}
    </nav>`;
}

function reportStyles() {
  return `
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --ink: #1a2c3e;
      --muted: #607487;
      --line: #d9e5ec;
      --head: #12384a;
      --accent: #0f5e7e;
      --accent-soft: #eaf4f8;
      --warn: #ad6720;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
      padding: 24px;
    }
    .container {
      max-width: 1440px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 18px 38px rgba(21, 43, 64, 0.12);
    }
    header {
      background: var(--head);
      color: #fff;
      padding: 24px 28px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: 0;
    }
    header p {
      margin: 0;
      max-width: 900px;
      color: rgba(255,255,255,0.82);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1px;
      background: var(--line);
      border-bottom: 1px solid var(--line);
    }
    .metric {
      background: #fff;
      padding: 18px 20px;
      min-width: 0;
    }
    .metric span, .summary-strip span {
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .metric strong {
      display: block;
      margin-top: 6px;
      font-size: 1rem;
      overflow-wrap: anywhere;
    }
    .metric small {
      display: block;
      margin-top: 5px;
      color: var(--muted);
    }
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1px;
      background: var(--line);
      border-bottom: 1px solid var(--line);
    }
    .summary-strip div {
      background: var(--accent-soft);
      padding: 14px 18px;
    }
    .summary-strip strong {
      display: block;
      margin-top: 4px;
      font-size: 1.45rem;
      color: var(--accent);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      background: #edf3f7;
      padding: 12px 18px 0;
      border-bottom: 1px solid var(--line);
    }
    .tab-btn {
      border: 0;
      border-radius: 6px 6px 0 0;
      padding: 12px 16px;
      background: transparent;
      color: #29495d;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      letter-spacing: 0;
    }
    .tab-btn span {
      display: inline-block;
      min-width: 24px;
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: #dceaf0;
      color: #23495d;
      font-size: 0.82rem;
    }
    .tab-btn.active {
      background: #fff;
      color: var(--accent);
      border-bottom: 3px solid var(--accent);
    }
    .tab-content {
      padding: 22px;
      overflow-x: auto;
    }
    .tab-pane { display: none; }
    .tab-pane.active-pane { display: block; }
    .table-wrapper {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow-x: auto;
      background: #fff;
    }
    .data-table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .data-table caption {
      caption-side: top;
      padding: 13px 16px;
      background: #f1f7fa;
      color: #195d77;
      text-align: center;
      font-weight: 800;
      border-bottom: 1px solid var(--line);
    }
    th, td {
      padding: 12px 11px;
      border-bottom: 1px solid #e7eef3;
      vertical-align: top;
      text-align: center;
    }
    th {
      background: #eef3f7;
      color: #154e64;
      font-size: 0.82rem;
    }
    .chapter-col {
      width: 92px;
      white-space: nowrap;
      font-weight: 700;
    }
    .wide-col { min-width: 280px; }
    tr:hover td { background: #fbfdfe; }
    .empty-cell {
      padding: 28px;
      text-align: center;
      color: var(--muted);
    }
    .note {
      margin-top: 14px;
      padding: 12px 14px;
      border-left: 4px solid var(--warn);
      background: #fff7ed;
      color: #714513;
      border-radius: 6px;
    }
    footer {
      padding: 14px 22px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.82rem;
      background: #f9fbfd;
    }
    @media (max-width: 820px) {
      body { padding: 12px; }
      .meta-grid, .summary-strip { grid-template-columns: 1fr; }
      header { padding: 20px; }
      .tab-content { padding: 14px; }
      .tab-btn { width: 100%; text-align: left; border-radius: 6px; }
    }
  `;
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
        panes.forEach((pane) => {
          pane.classList.toggle('active-pane', pane.id === targetId);
        });
        localStorage.setItem('pdfEpubComparisonActiveTab', targetId);
      }

      buttons.forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
      });

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
      <p>Comparacao editorial entre o PDF original e o EPUB traduzido/validado. Os achados sao informativos e exigem revisao humana.</p>
    </header>
    ${renderMeta(audit)}
    ${renderSummary(audit)}
    ${renderTabs(categories)}
    <div class="tab-content">
      ${categories.map(renderPane).join('')}
    </div>
    <footer>
      Gerado em ${escapeHtml(generatedAt)}. Nenhuma correcao automatica foi aplicada.
    </footer>
  </main>
  <script>${reportScript()}</script>
</body>
</html>`;
}

export function writePdfEpubComparisonReport(audit, htmlPath) {
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = buildPdfEpubComparisonHtml(audit);
  fs.writeFileSync(htmlPath, html, 'utf8');
  return {
    htmlPath,
    relativePath: htmlPath,
  };
}
