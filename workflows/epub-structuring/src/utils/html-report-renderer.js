import fs from 'fs-extra';
import path from 'node:path';
import { SEVERITY, buildReportPresentation } from './report-findings.js';

export async function renderHtmlReport(reportContext) {
  const run = await readJsonIfExists(reportContext.runFile);
  const reports = await readDataReports(reportContext.dataDir);
  const html = buildHtml({ run, reports });
  const reportPath = path.join(reportContext.runDir, 'report.html');
  await fs.writeFile(reportPath, html, 'utf8');
  return reportPath;
}

async function readDataReports(dataDir) {
  if (!(await fs.pathExists(dataDir))) return {};
  const entries = await fs.readdir(dataDir);
  const reports = {};
  for (const entry of entries.filter((name) => name.endsWith('.json') && name !== 'run.json').sort()) {
    reports[entry] = await readJsonIfExists(path.join(dataDir, entry));
  }
  return reports;
}

async function readJsonIfExists(filePath) {
  if (!(await fs.pathExists(filePath))) return null;
  return fs.readJson(filePath);
}

function buildHtml({ run, reports }) {
  const presentation = buildReportPresentation({ run, reports });
  const sections = [
    renderOverview(run),
    renderResult(presentation.result),
    renderFindings(presentation.findings),
    renderSuggestedActions(presentation.actions),
    renderPipelineSummary(reports),
    renderValidationSummary(reports),
    renderAvailableReports(reports)
  ].filter(Boolean).join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(run?.operationLabel || 'Relatório EPUB')}</title>
  <style>
    :root { color-scheme: light dark; --bg: #f7f7f4; --panel: #ffffff; --text: #1f2933; --muted: #65717f; --line: #d8ddd9; --accent: #087ea4; --ok: #137333; --warn: #9a6700; --bad: #b42318; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111315; --panel: #1b1f23; --text: #eef2f5; --muted: #a5adb6; --line: #30363d; --accent: #4db6d7; --ok: #6fce87; --warn: #f2c96d; --bad: #ff8a80; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
    main { width: min(1120px, calc(100% - 32px)); margin: 32px auto; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); }
    h2 { margin: 0 0 14px; font-size: 1.1rem; }
    section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin: 16px 0; }
    dl { display: grid; grid-template-columns: minmax(130px, 220px) 1fr; gap: 8px 16px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th, td { padding: 9px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    .muted { color: var(--muted); }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; font-size: 0.86rem; }
    .finding-title { font-weight: 600; }
    .actions { margin: 0; padding-left: 20px; }
    .success { color: var(--ok); }
    .warning { color: var(--warn); }
    .failed { color: var(--bad); }
    @media (max-width: 680px) { main { width: min(100% - 20px, 1120px); margin: 16px auto; } dl { grid-template-columns: 1fr; } th:nth-child(3), td:nth-child(3) { display: none; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(run?.operationLabel || 'Relatório EPUB')}</h1>
      <div class="muted">Run <code>${escapeHtml(run?.runId || 'desconhecido')}</code></div>
    </header>
    ${sections}
  </main>
</body>
</html>
`;
}

function renderResult(result) {
  if (!result) return '';
  return `<section>
  <h2>Resultado</h2>
  <dl>
    <dt>Status</dt><dd><span class="pill ${resultClass(result.status)}">${escapeHtml(result.status)}</span></dd>
    <dt>OK</dt><dd>${result.okCount}</dd>
    <dt>Atenção</dt><dd>${result.warningCount}</dd>
    <dt>Problemas</dt><dd>${result.problemCount}</dd>
    <dt>Informações</dt><dd>${result.infoCount}</dd>
  </dl>
</section>`;
}

function renderFindings(findings) {
  if (!findings?.length) return '';
  return `<section>
  <h2>Diagnóstico</h2>
  <table>
    <thead><tr><th>Severidade</th><th>Item</th><th>Mensagem</th><th>Fonte</th></tr></thead>
    <tbody>${findings.map((item) => `<tr><td>${formatSeverity(item.severity)}</td><td class="finding-title">${escapeHtml(item.title)}</td><td>${escapeHtml(item.message)}</td><td>${item.source ? `<code>${escapeHtml(item.source)}</code>` : '<span class="muted">-</span>'}</td></tr>`).join('')}</tbody>
  </table>
</section>`;
}

function renderSuggestedActions(actions) {
  if (!actions?.length) return '';
  return `<section>
  <h2>Próximas Ações Sugeridas</h2>
  <ul class="actions">${actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul>
</section>`;
}

function renderOverview(run) {
  if (!run) return '';
  return `<section>
  <h2>Execução</h2>
  <dl>
    <dt>Status</dt><dd><span class="pill ${statusClass(run.status)}">${escapeHtml(run.status)}</span></dd>
    <dt>Operação</dt><dd><code>${escapeHtml(run.operation)}</code></dd>
    <dt>Início</dt><dd>${escapeHtml(run.startedAt || '-')}</dd>
    <dt>Fim</dt><dd>${escapeHtml(run.finishedAt || '-')}</dd>
    <dt>Entradas</dt><dd>${formatList(run.inputs)}</dd>
    <dt>Saída</dt><dd>${run.output ? `<code>${escapeHtml(run.output)}</code>` : '<span class="muted">-</span>'}</dd>
    ${run.error ? `<dt>Erro</dt><dd class="failed">${escapeHtml(run.error.message)}</dd>` : ''}
  </dl>
</section>`;
}

function formatSeverity(severityKey) {
  const severity = SEVERITY[severityKey] || SEVERITY.info;
  return `<span class="${severityClass(severityKey)}">${severity.marker} ${escapeHtml(severity.label)}</span>`;
}

function resultClass(status) {
  if (status === 'OK') return 'success';
  if (status === 'ATENÇÃO') return 'warning';
  if (status === 'PROBLEMA') return 'failed';
  return '';
}

function severityClass(severity) {
  if (severity === 'ok') return 'success';
  if (severity === 'warning' || severity === 'info') return 'warning';
  if (severity === 'problem') return 'failed';
  return '';
}

function renderPipelineSummary(reports) {
  const chapter = reports['chapter_report.json'];
  const resplit = reports['chapter_resplit_report.json'];
  const toc = reports['toc_report.json'];
  const structure = reports['structure_report.json'];
  const language = reports['language_report.json'];
  if (!chapter && !resplit && !toc && !structure && !language) return '';

  return `<section>
  <h2>Estrutura</h2>
  <dl>
    ${row('Capítulos', chapter?.chapterCount)}
    ${row('Resplit', resplit?.chapterCount)}
    ${row('TOC', toc?.entryCount ?? toc?.entries?.length)}
    ${row('Spine', structure?.summary?.spineItems)}
    ${row('HTMLs', structure?.summary?.htmlItems)}
    ${row('Idioma', language?.detectedLanguage || language?.metadataLanguage)}
  </dl>
</section>`;
}

function renderValidationSummary(reports) {
  const validation = reports['validation_report.json'];
  const regression = reports['final_regression_report.json'];
  const finalValidation = reports['final_epub_validation.json'];
  const integrity = reports['chapter_integrity_report.json'];
  if (!validation && !regression && !finalValidation && !integrity) return '';

  const rows = [
    ['EPUB 3', validation?.ok, validation?.issues?.length],
    ['Regressão final', regression?.ok, regression?.errors?.length],
    ['Pacote final', finalValidation?.ok, finalValidation?.errors?.length],
    ['Integridade', integrity?.status, integrity?.errors?.length]
  ].filter(([, value]) => value !== undefined);

  return `<section>
  <h2>Validação</h2>
  <table>
    <thead><tr><th>Item</th><th>Resultado</th><th>Observações</th></tr></thead>
    <tbody>${rows.map(([label, value, count]) => `<tr><td>${escapeHtml(label)}</td><td>${formatStatus(value)}</td><td>${formatIssueCount(count)}</td></tr>`).join('')}</tbody>
  </table>
</section>`;
}

function renderAvailableReports(reports) {
  const names = Object.keys(reports).sort();
  if (!names.length) return '';
  return `<section>
  <h2>Dados Disponíveis</h2>
  <table>
    <thead><tr><th>Arquivo</th><th>Resumo</th></tr></thead>
    <tbody>${names.map((name) => `<tr><td><code>${escapeHtml(name)}</code></td><td>${escapeHtml(summarizeReport(reports[name]))}</td></tr>`).join('')}</tbody>
  </table>
</section>`;
}

function row(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>`;
}

function formatList(items = []) {
  if (!items.length) return '<span class="muted">-</span>';
  return items.map((item) => `<code>${escapeHtml(item)}</code>`).join('<br>');
}

function formatStatus(value) {
  const text = typeof value === 'boolean' ? (value ? 'OK' : 'Falhou') : String(value);
  return `<span class="${statusClass(value)}">${escapeHtml(text)}</span>`;
}

function statusClass(value) {
  const normalized = String(value).toLowerCase();
  if (value === true || ['success', 'ok', 'already_clean', 'fixed'].includes(normalized)) return 'success';
  if (['running', 'blocked', 'partial_success', 'review_required'].includes(normalized)) return 'warning';
  if (value === false || ['failed', 'error'].includes(normalized)) return 'failed';
  return '';
}

function formatIssueCount(count) {
  if (count === undefined || count === null) return '<span class="muted">-</span>';
  return count === 0 ? 'sem issues' : `${count} issue(s)`;
}

function summarizeReport(report) {
  if (!report || typeof report !== 'object') return 'JSON';
  if (report.status) return `status: ${report.status}`;
  if (typeof report.ok === 'boolean') return `ok: ${report.ok}`;
  if (Number.isInteger(report.chapterCount)) return `chapterCount: ${report.chapterCount}`;
  if (Number.isInteger(report.entryCount)) return `entryCount: ${report.entryCount}`;
  if (report.summary && typeof report.summary === 'object') return 'summary';
  if (Array.isArray(report)) return `${report.length} item(ns)`;
  return `${Object.keys(report).length} campo(s)`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
