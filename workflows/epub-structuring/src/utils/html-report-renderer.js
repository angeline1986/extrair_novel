import fs from 'fs-extra';
import path from 'node:path';
import { SEVERITY, buildReportPresentation } from './report-findings.js';
import { buildOperationSpecificPages } from './report-adapters/index.js';

export async function renderHtmlReport(reportContext) {
  const run = await readJsonIfExists(reportContext.runFile);
  const reports = await readDataReports(reportContext.dataDir);
  const html = buildHtml({ run, reports, reportContext });
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

function buildHtml({ run, reports, reportContext }) {
  const model = buildReportModel({ run, reports, reportContext });
  const nav = model.pages.map((page) => `<button class="${page.id === model.activePage ? 'active' : ''}" data-page="${escapeAttr(page.id)}">${page.icon} ${escapeHtml(page.label)}</button>`).join('\n');
  const options = model.pages.map((page) => `<option value="${escapeAttr(page.id)}">${escapeHtml(page.label)}</option>`).join('\n');
  const pages = model.pages.map((page) => renderPage(page, page.id === model.activePage)).join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)} · EPUB Structuring</title>
  <style>
    :root { --bg:#f3f5f8; --panel:#fff; --panel-soft:#f8fafc; --text:#172033; --muted:#667085; --line:#e4e7ec; --accent:#2563eb; --accent-soft:#eef4ff; --ok:#15803d; --ok-soft:#ecfdf3; --warn:#b45309; --warn-soft:#fff7ed; --danger:#b42318; --danger-soft:#fef3f2; --info:#2563eb; --info-soft:#eef4ff; --shadow:0 10px 30px rgba(16,24,40,.06); --radius:16px; --sidebar:255px; }
    @media (prefers-color-scheme: dark) { :root { --bg:#0f1420; --panel:#171e2b; --panel-soft:#121924; --text:#edf2f7; --muted:#98a2b3; --line:#2b3445; --accent:#7aa2ff; --accent-soft:#19233a; --ok:#7bd88f; --ok-soft:#14271a; --warn:#f0b35e; --warn-soft:#332510; --danger:#ff8f87; --danger-soft:#331a19; --info:#9bb7ff; --info-soft:#19233a; --shadow:none; } }
    * { box-sizing:border-box; }
    html, body { margin:0; min-height:100%; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; overflow:hidden; }
    .app { min-height:100vh; display:grid; grid-template-columns:var(--sidebar) minmax(0,1fr); }
    aside { height:100vh; border-right:1px solid var(--line); background:var(--panel); padding:24px 18px; display:flex; flex-direction:column; }
    .brand { display:flex; align-items:center; gap:12px; padding:0 8px 22px; border-bottom:1px solid var(--line); margin-bottom:18px; }
    .brand-mark { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:var(--accent-soft); font-size:21px; }
    .brand strong { display:block; font-size:15px; }
    .brand small { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
    nav { display:grid; gap:5px; }
    nav button { width:100%; border:0; background:transparent; color:var(--muted); font:inherit; text-align:left; padding:11px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:.16s ease; }
    nav button:hover { color:var(--text); background:var(--panel-soft); }
    nav button.active { color:var(--accent); background:var(--accent-soft); font-weight:700; }
    .sidebar-footer { margin-top:auto; padding:18px 8px 0; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
    .content-shell { height:100vh; display:flex; flex-direction:column; min-width:0; }
    .topbar { height:68px; border-bottom:1px solid var(--line); background:color-mix(in srgb,var(--panel) 94%,transparent); display:flex; align-items:center; justify-content:space-between; padding:0 28px; flex:0 0 auto; gap:16px; }
    .topbar-title { min-width:0; font-size:14px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .topbar-title strong { color:var(--text); font-weight:700; }
    .status-badge, .pill { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:7px 10px; font-size:12px; font-weight:700; border:1px solid var(--line); background:var(--panel-soft); color:var(--muted); }
    .status-badge.ok, .pill.ok { color:var(--ok); background:var(--ok-soft); border-color:color-mix(in srgb,var(--ok) 20%,var(--line)); }
    .status-badge.warn, .pill.warn { color:var(--warn); background:var(--warn-soft); border-color:color-mix(in srgb,var(--warn) 20%,var(--line)); }
    .status-badge.danger, .pill.danger { color:var(--danger); background:var(--danger-soft); border-color:color-mix(in srgb,var(--danger) 20%,var(--line)); }
    .status-badge.info, .pill.info { color:var(--info); background:var(--info-soft); border-color:color-mix(in srgb,var(--info) 20%,var(--line)); }
    .pages { flex:1 1 auto; min-height:0; overflow:hidden; }
    .page { display:none; height:100%; overflow-y:auto; padding:28px; }
    .page.active { display:block; }
    .page-inner { width:min(1180px,100%); margin:0 auto; }
    .page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:22px; }
    .eyebrow { font-size:12px; text-transform:uppercase; color:var(--accent); letter-spacing:.06em; font-weight:800; margin-bottom:6px; }
    h1 { margin:0; font-size:clamp(1.8rem,3vw,2.6rem); letter-spacing:0; line-height:1.1; }
    h2 { margin:0 0 4px; font-size:18px; letter-spacing:0; }
    .subtitle { margin:9px 0 0; color:var(--muted); max-width:800px; word-break:break-word; }
    .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:18px; }
    .metric, .card { background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); }
    .metric { padding:20px; }
    .metric .label { color:var(--muted); font-size:13px; margin-bottom:8px; }
    .metric .value { font-size:30px; font-weight:800; letter-spacing:0; word-break:break-word; }
    .metric .hint { margin-top:4px; color:var(--muted); font-size:12px; }
    .card { padding:22px; margin-bottom:16px; }
    .card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px; }
    .card-desc { color:var(--muted); font-size:13px; }
    .info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .info-item { padding:15px; border-radius:12px; border:1px solid var(--line); background:var(--panel-soft); }
    .info-item span { display:block; color:var(--muted); font-size:12px; margin-bottom:4px; }
    .info-item strong { font-size:14px; word-break:break-word; }
    .pill-row { display:flex; gap:10px; flex-wrap:wrap; }
    .finding { display:flex; gap:14px; padding:15px 0; border-top:1px solid var(--line); align-items:flex-start; }
    .finding:first-child { border-top:0; }
    .finding-icon { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; flex:0 0 auto; font-weight:800; }
    .finding.ok .finding-icon { color:var(--ok); background:var(--ok-soft); }
    .finding.warn .finding-icon { color:var(--warn); background:var(--warn-soft); }
    .finding.danger .finding-icon { color:var(--danger); background:var(--danger-soft); }
    .finding.info .finding-icon { color:var(--info); background:var(--info-soft); }
    .finding strong { display:block; font-size:14px; margin-bottom:2px; }
    .finding p { margin:0; color:var(--muted); font-size:13px; }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { padding:12px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:700; }
    tr:last-child td { border-bottom:0; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.92em; }
    .artifact { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 0; border-top:1px solid var(--line); }
    .artifact:first-of-type { border-top:0; }
    .artifact strong { display:block; font-size:14px; }
    .artifact small { color:var(--muted); word-break:break-word; }
    .tag { flex:0 0 auto; border-radius:999px; padding:5px 9px; font-size:12px; font-weight:700; color:var(--accent); background:var(--accent-soft); }
    .technical-grid { display:grid; grid-template-columns:180px 1fr; gap:10px 16px; margin:0; font-size:13px; }
    .technical-grid dt { color:var(--muted); }
    .technical-grid dd { margin:0; word-break:break-word; }
    .callout { border-radius:12px; padding:14px 16px; border:1px solid var(--line); background:var(--panel-soft); color:var(--muted); font-size:13px; }
    .callout.warn { color:var(--warn); background:var(--warn-soft); border-color:color-mix(in srgb,var(--warn) 20%,var(--line)); }
    .actions { margin:0; padding-left:20px; color:var(--muted); }
    .mobile-nav { display:none; }
    @media (max-width:900px) { body{overflow:auto;} .app{grid-template-columns:1fr;} aside{display:none;} .content-shell{height:auto;min-height:100vh;} .topbar{position:sticky;top:0;z-index:10;height:auto;min-height:64px;padding:10px 14px;gap:12px;} .mobile-nav{display:block;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:8px 10px;} .pages{overflow:visible;} .page{height:auto;min-height:calc(100vh - 64px);padding:20px 14px;} }
    @media (max-width:700px) { .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .info-grid{grid-template-columns:1fr;} .technical-grid{grid-template-columns:1fr;} .page-head{flex-direction:column;} .artifact{align-items:flex-start;flex-direction:column;} }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <div class="brand"><div class="brand-mark">📚</div><div><strong>EPUB Structuring</strong><small>${escapeHtml(model.operationLabel)}</small></div></div>
      <nav id="sidebarNav">${nav}</nav>
      <div class="sidebar-footer">Execução <code>${escapeHtml(model.runId)}</code><br>${escapeHtml(model.startedDateShort)}</div>
    </aside>
    <div class="content-shell">
      <header class="topbar">
        <div class="topbar-title"><strong>${escapeHtml(model.title)}</strong> · ${escapeHtml(model.operationLabel)}</div>
        <select class="mobile-nav" id="mobileNav" aria-label="Navegar pelas páginas">${options}</select>
        <div class="status-badge ${statusClass(model.result.status)}">${escapeHtml(statusText(model.result.status))}</div>
      </header>
      <div class="pages">${pages}</div>
    </div>
  </div>
  <script>
    const pages = [...document.querySelectorAll('.page')];
    const navButtons = [...document.querySelectorAll('#sidebarNav button')];
    const mobileNav = document.getElementById('mobileNav');
    function showPage(pageName, updateHash = true) {
      const target = pages.find(page => page.dataset.page === pageName);
      if (!target) return;
      pages.forEach(page => page.classList.toggle('active', page === target));
      navButtons.forEach(button => button.classList.toggle('active', button.dataset.page === pageName));
      if (mobileNav) mobileNav.value = pageName;
      if (updateHash) history.replaceState(null, '', '#' + pageName);
      target.scrollTop = 0;
    }
    navButtons.forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
    if (mobileNav) mobileNav.addEventListener('change', () => showPage(mobileNav.value));
    const initial = location.hash.replace('#', '');
    if (initial && pages.some(page => page.dataset.page === initial)) showPage(initial, false);
  </script>
</body>
</html>
`;
}

function buildReportModel({ run, reports, reportContext }) {
  const presentation = buildReportPresentation({ run, reports });
  const analysis = reports['epub_analysis_report.json'] || {};
  const chapter = reports['chapter_report.json'] || {};
  const toc = reports['toc_report.json'] || {};
  const structure = reports['structure_report.json'] || {};
  const language = reports['language_report.json'] || {};
  const title = firstPresent(analysis.title, titleFromRun(run), run?.operationLabel, 'Relatório EPUB');
  const operationLabel = run?.operationLabel || run?.operation || 'Execução';
  const artifacts = buildArtifacts(reports, reportContext);
  const common = {
    run,
    reports,
    presentation,
    analysis,
    chapter,
    toc,
    structure,
    language,
    artifacts,
    title,
    operationLabel,
    runId: run?.runId || reportContext?.runId || 'desconhecido',
    startedDateShort: formatDate(run?.startedAt, { dateOnly: true }),
    result: presentation.result
  };
  const operationSpecificPages = buildOperationSpecificPages(common, {
    metric,
    card,
    table,
    tableRow,
    htmlCell,
    escapeHtml
  });
  const pageCandidates = operationSpecificPages.length
    ? [
        ...operationSpecificPages,
        diagnosisPage(common),
        technicalPage(common),
        artifactsPage(common)
      ]
    : [
        overviewPage(common),
        bookPage(common),
        structurePage(common),
        navigationPage(common),
        diagnosisPage(common),
        technicalPage(common),
        artifactsPage(common)
      ];
  const pages = pageCandidates.filter(Boolean);
  return { ...common, pages, activePage: pages[0]?.id || 'overview' };
}

function overviewPage(model) {
  const metrics = [
    metric('Manifest', model.analysis.manifestItems ?? model.structure.summary?.manifestItems, 'itens registrados'),
    metric('Spine', model.analysis.spineItems ?? model.structure.summary?.spineItems, 'itens de leitura'),
    metric('HTML / XHTML', model.analysis.htmlDocuments ?? model.structure.summary?.htmlItems, 'documentos lidos'),
    metric('TOC', model.analysis.tocEntries ?? model.toc.entryCount ?? model.toc.entries?.length, 'entradas encontradas')
  ].filter(Boolean);
  const pills = [
    navPill('NCX', model.analysis.hasNcx ?? model.toc.hasNcx),
    navPill('NAV', model.analysis.hasNav ?? model.toc.hasNav),
    model.analysis.language || model.language.detectedLanguage || model.language.metadataLanguage ? `<span class="pill info">🌐 Idioma: ${escapeHtml(model.analysis.language || model.language.detectedLanguage || model.language.metadataLanguage)}</span>` : '',
    model.analysis.tocEntries || model.toc.entryCount ? `<span class="pill info">📑 TOC: ${escapeHtml(model.analysis.tocEntries ?? model.toc.entryCount)}</span>` : ''
  ].filter(Boolean).join('\n');
  const principal = model.presentation.findings.find((finding) => finding.severity === 'problem') || model.presentation.findings.find((finding) => finding.severity === 'warning');
  return {
    id: 'overview',
    label: 'Visão geral',
    icon: '📊',
    title: model.title,
    subtitle: firstPresent(model.analysis.sourceFile, model.run?.inputs?.join(', '), model.operationLabel),
    content: [
      metrics.length ? `<div class="metric-grid">${metrics.join('')}</div>` : '',
      pills ? card('Resumo da análise', 'Leitura rápida do estado estrutural da execução.', `<div class="pill-row">${pills}</div>`) : '',
      principal ? card('Atenção principal', 'O ponto mais importante para revisar agora.', `<div class="callout warn">${escapeHtml(principal.title)}: ${escapeHtml(principal.message)}</div>`) : ''
    ].join('\n')
  };
}

function bookPage(model) {
  const items = [
    infoItem('Título', model.analysis.title),
    infoItem('Autor', model.analysis.author),
    infoItem('Idioma declarado', model.analysis.language || model.language.metadataLanguage),
    infoItem('Arquivo', model.analysis.sourceFile || model.run?.inputs?.[0]),
    infoItem('Identificador', model.analysis.identifier),
    infoItem('Container rootfile', model.analysis.containerRootfile),
    infoItem('Versão EPUB', model.reports['epub_metadata_report.json']?.version)
  ].filter(Boolean);
  if (!items.length) return null;
  return { id: 'book', label: 'Livro', icon: '📖', title: 'Informações do livro', subtitle: 'Metadados editoriais e identificação do arquivo analisado.', content: card(null, null, `<div class="info-grid">${items.join('')}</div>`) };
}

function structurePage(model) {
  const metrics = [
    metric('Manifest', model.analysis.manifestItems ?? model.structure.summary?.manifestItems, 'itens'),
    metric('Spine', model.analysis.spineItems ?? model.structure.summary?.spineItems, 'itens'),
    metric('HTML / XHTML', model.analysis.htmlDocuments ?? model.structure.summary?.htmlItems, 'lidos'),
    metric('Capítulos', model.chapter.chapterCount, 'detectados')
  ].filter(Boolean);
  const rows = [
    tableRow(['Manifest', model.analysis.manifestItems ?? model.structure.summary?.manifestItems, htmlCell(presentBadge(model.analysis.manifestItems ?? model.structure.summary?.manifestItems))]),
    tableRow(['Spine', model.analysis.spineItems ?? model.structure.summary?.spineItems, htmlCell(presentBadge(model.analysis.spineItems ?? model.structure.summary?.spineItems))]),
    tableRow(['HTML/XHTML', model.analysis.htmlDocuments ?? model.structure.summary?.htmlItems, htmlCell(presentBadge(model.analysis.htmlDocuments ?? model.structure.summary?.htmlItems))]),
    tableRow(['Capítulos', model.chapter.chapterCount, htmlCell(presentBadge(model.chapter.chapterCount))])
  ].filter(Boolean).join('');
  if (!metrics.length && !rows) return null;
  return { id: 'structure', label: 'Estrutura', icon: '🧱', title: 'Estrutura do EPUB', subtitle: 'Resumo dos principais componentes internos disponíveis.', content: `${metrics.length ? `<div class="metric-grid">${metrics.join('')}</div>` : ''}${rows ? card(null, null, table(['Componente', 'Quantidade', 'Situação'], rows)) : ''}` };
}

function navigationPage(model) {
  const hasAny = model.analysis.hasNav !== undefined || model.analysis.hasNcx !== undefined || model.toc.hasNav !== undefined || model.toc.hasNcx !== undefined || model.analysis.tocEntries !== undefined || model.toc.entryCount !== undefined;
  if (!hasAny) return null;
  const nav = model.analysis.hasNav ?? model.toc.hasNav;
  const ncx = model.analysis.hasNcx ?? model.toc.hasNcx;
  const tocCount = model.analysis.tocEntries ?? model.toc.entryCount ?? model.toc.entries?.length;
  const spine = model.analysis.spineItems ?? model.structure.summary?.spineItems;
  const pills = [navPill('NCX', ncx), navPill('NAV', nav), tocCount !== undefined ? `<span class="pill info">TOC: ${escapeHtml(tocCount)} entradas</span>` : '', spine !== undefined ? `<span class="pill info">Spine: ${escapeHtml(spine)} itens</span>` : ''].filter(Boolean).join('\n');
  const rows = [
    tableRow(['NCX', htmlCell(statusBadge(ncx)), ncx === true ? 'Navegação NCX detectada.' : ncx === false ? 'NCX não detectado.' : 'Sem dado disponível.']),
    tableRow(['NAV', htmlCell(statusBadge(nav)), nav === true ? 'Documento NAV detectado.' : nav === false ? 'NAV não detectado.' : 'Sem dado disponível.']),
    tocCount !== undefined ? tableRow(['TOC', `${tocCount} entradas`, 'Entradas identificadas durante a análise.']) : '',
    spine !== undefined ? tableRow(['Spine', `${spine} itens`, 'Itens de leitura registrados.']) : ''
  ].filter(Boolean).join('');
  return { id: 'navigation', label: 'Navegação', icon: '🧭', title: 'Sumário e navegação', subtitle: 'Presença e estado dos mecanismos de navegação do EPUB.', content: `${card(null, null, `<div class="pill-row">${pills}</div>`)}${card(null, null, table(['Item', 'Resultado', 'Observação'], rows))}` };
}

function diagnosisPage(model) {
  if (!model.presentation.findings.length) return null;
  const findings = model.presentation.findings.map(renderFinding).join('\n');
  const actions = model.presentation.actions?.length ? card('Próximas ações sugeridas', null, `<ul class="actions">${model.presentation.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul>`) : '';
  return { id: 'diagnosis', label: 'Diagnóstico', icon: '🔎', title: 'Achados da análise', subtitle: 'O que está correto e o que merece atenção.', content: `${card(null, null, findings)}${actions}` };
}

function technicalPage(model) {
  const rows = [
    detailRow('Run ID', htmlCell(`<code>${escapeHtml(model.run?.runId || model.runId)}</code>`)),
    detailRow('Operação', model.operationLabel),
    model.run?.operation ? detailRow('Identificador técnico', htmlCell(`<code>${escapeHtml(model.run.operation)}</code>`)) : '',
    detailRow('Início', formatDate(model.run?.startedAt)),
    detailRow('Fim', formatDate(model.run?.finishedAt)),
    detailRow('Duração', formatDuration(model.run?.startedAt, model.run?.finishedAt)),
    model.run?.status ? detailRow('Status', model.run.status) : '',
    model.run?.inputs?.length ? detailRow('Entrada', htmlCell(model.run.inputs.map((item) => `<code>${escapeHtml(item)}</code>`).join('<br>'))) : '',
    detailRow('Saída', model.run?.output ? htmlCell(`<code>${escapeHtml(model.run.output)}</code>`) : 'Sem arquivo de saída nesta operação.')
  ].filter(Boolean).join('\n');
  return { id: 'technical', label: 'Dados técnicos', icon: '🛠️', title: 'Execução', subtitle: 'Informações úteis para auditoria e depuração.', content: card(null, null, `<dl class="technical-grid">${rows}</dl>`) };
}

function artifactsPage(model) {
  if (!model.artifacts.length) return null;
  return { id: 'artifacts', label: 'Artefatos', icon: '🗂️', title: 'Arquivos gerados', subtitle: 'Relatórios associados a esta execução.', content: card(null, null, model.artifacts.map(renderArtifact).join('\n')) };
}

function renderPage(page, active) {
  return `<section class="page ${active ? 'active' : ''}" data-page="${escapeAttr(page.id)}"><div class="page-inner"><div class="page-head"><div><div class="eyebrow">${escapeHtml(page.label)}</div><h1>${escapeHtml(page.title)}</h1>${page.subtitle ? `<p class="subtitle">${escapeHtml(page.subtitle)}</p>` : ''}</div></div>${page.content}</div></section>`;
}

function metric(label, value, hint) {
  if (value === undefined || value === null || value === '') return '';
  return `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ''}</div>`;
}

function card(title, desc, content) {
  return `<div class="card">${title ? `<div class="card-header"><div><h2>${escapeHtml(title)}</h2>${desc ? `<div class="card-desc">${escapeHtml(desc)}</div>` : ''}</div></div>` : ''}${content}</div>`;
}

function infoItem(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<div class="info-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tableRow(values) {
  if (values[1] === undefined || values[1] === null || values[1] === '') return '';
  return `<tr>${values.map((value) => `<td>${renderCell(value)}</td>`).join('')}</tr>`;
}

function detailRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<dt>${escapeHtml(label)}</dt><dd>${renderCell(value)}</dd>`;
}

function htmlCell(value) {
  return { html: value };
}

function renderCell(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'html')) return value.html;
  return escapeHtml(value);
}

function renderFinding(finding) {
  const cls = severityClass(finding.severity);
  const severity = SEVERITY[finding.severity] || SEVERITY.info;
  return `<div class="finding ${cls}"><div class="finding-icon">${escapeHtml(severity.marker)}</div><div><strong>${escapeHtml(finding.title)}</strong><p>${escapeHtml(finding.message)}${finding.action ? ` Próxima ação: ${escapeHtml(finding.action)}` : ''}</p></div></div>`;
}

function buildArtifacts(reports, reportContext) {
  const artifacts = Object.keys(reports).sort().map((name) => ({ name, desc: summarizeArtifact(name), tag: 'JSON técnico', path: `data/${name}` }));
  if (reportContext?.runDir) artifacts.push({ name: 'report.html', desc: 'Relatório visual para leitura humana.', tag: 'HTML', path: 'report.html' });
  return artifacts;
}

function renderArtifact(artifact) {
  return `<div class="artifact"><div><strong>${escapeHtml(artifact.name)}</strong><small>${escapeHtml(artifact.desc)}${artifact.path ? ` · ${escapeHtml(artifact.path)}` : ''}</small></div><span class="tag">${escapeHtml(artifact.tag)}</span></div>`;
}

function summarizeArtifact(name) {
  if (name === 'epub_analysis_report.json') return 'Dados estruturados da análise do EPUB.';
  if (name === 'chapter_report.json') return 'Dados estruturados de capítulos.';
  if (name === 'toc_report.json') return 'Dados estruturados do sumário.';
  if (name === 'validation_report.json') return 'Resultado técnico de validação.';
  if (name === 'final_regression_report.json') return 'Resultado da regressão final.';
  if (name === 'merge_report.json') return 'Resultado técnico do merge.';
  if (name === 'batch_report.json') return 'Resultado técnico do lote.';
  return 'Dados técnicos estruturados.';
}

function navPill(label, present) {
  if (present === undefined || present === null) return '';
  return present ? `<span class="pill ok">✓ ${escapeHtml(label)} presente</span>` : `<span class="pill warn">⚠ ${escapeHtml(label)} ausente</span>`;
}

function statusBadge(value) {
  if (value === true) return '<span class="pill ok">✓ Presente</span>';
  if (value === false) return '<span class="pill warn">⚠ Ausente</span>';
  return '<span class="pill info">— Não executado</span>';
}

function presentBadge(value) {
  if (value === undefined || value === null || value === '') return '';
  return Number(value) > 0 ? '<span class="pill ok">✓ Encontrado</span>' : '<span class="pill warn">⚠ Ausente</span>';
}

function statusText(status) {
  if (status === 'OK') return '✓ OK';
  if (status === 'ATENÇÃO') return '⚠ ATENÇÃO';
  if (status === 'PROBLEMA') return '✗ PROBLEMA';
  return status || 'Status';
}

function statusClass(status) {
  if (status === 'OK') return 'ok';
  if (status === 'ATENÇÃO') return 'warn';
  if (status === 'PROBLEMA') return 'danger';
  return 'info';
}

function severityClass(severity) {
  if (severity === 'ok') return 'ok';
  if (severity === 'warning') return 'warn';
  if (severity === 'problem') return 'danger';
  return 'info';
}

function titleFromRun(run) {
  return run?.inputs?.[0] ? path.basename(run.inputs[0], path.extname(run.inputs[0])) : null;
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || '';
}

function formatDate(value, options = {}) {
  if (!value) return 'Não registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (options.dateOnly) return `${dd}/${mm}/${yyyy}`;
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}:${ss}`;
}

function formatDuration(start, end) {
  if (!start || !end) return 'Não registrada';
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'Não registrada';
  const seconds = Math.max(0, (endMs - startMs) / 1000);
  return `${seconds.toFixed(2).replace('.', ',')} s`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
