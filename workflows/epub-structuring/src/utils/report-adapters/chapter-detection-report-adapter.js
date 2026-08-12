export function buildChapterDetectionPages(model, ui) {
  const internal = model.reports['internal_chapter_report.json'];
  const spine = model.reports['spine_chapter_report.json'];
  if (!internal && !spine) return [];

  const recommended = chooseRecommendedSource({ internal, spine });
  const primary = recommended === 'internal-dom' ? internal : spine || internal;
  const sequence = summarizeSequence(primary);
  const divergences = collectDetectionDivergences({ internal, spine });

  return [
    overviewPage({ internal, spine, recommended, sequence, divergences }, ui),
    chaptersPage(primary, ui),
    sourcesPage({ internal, spine, recommended }, ui),
    divergencesPage(divergences, ui)
  ].filter(Boolean);
}

function overviewPage(data, ui) {
  const { internal, spine, recommended, sequence, divergences } = data;
  const metrics = [
    ui.metric('Capítulos detectados', data[recommended === 'internal-dom' ? 'internal' : 'spine']?.chapterCount ?? internal?.chapterCount ?? spine?.chapterCount, recommended),
    ui.metric('Spine', spine?.chapterCount, 'capítulos'),
    ui.metric('Internal DOM', internal?.chapterCount, 'capítulos'),
    ui.metric('Divergências', divergences.length, 'itens para revisar')
  ].filter(Boolean).join('');
  const rows = [
    ui.tableRow(['Fonte recomendada', recommended || 'Indefinida']),
    ui.tableRow(['Sequência', sequence.range || 'Indisponível']),
    ui.tableRow(['Ausentes', sequence.missingCount]),
    ui.tableRow(['Duplicados', sequence.duplicateCount]),
    ui.tableRow(['Fora de ordem', sequence.outOfOrderCount]),
    ui.tableRow(['Candidatos rejeitados', internal?.diagnostics?.rejectedCandidates?.length])
  ].filter(Boolean).join('');
  return {
    id: 'overview',
    label: 'Visão geral',
    icon: '📊',
    title: 'Detecção de capítulos',
    subtitle: 'Resumo comparativo das fontes de detecção disponíveis nesta execução.',
    content: `${metrics ? `<div class="metric-grid">${metrics}</div>` : ''}${rows ? ui.card('Resumo técnico', null, ui.table(['Item', 'Valor'], rows)) : ''}`
  };
}

function chaptersPage(report, ui) {
  const chapters = report?.chapters || [];
  if (!chapters.length) return null;
  const rows = chapters.slice(0, 80).map((chapter) => ui.tableRow([
    chapter.chapterNumber,
    chapter.finalTitle || chapter.title || chapter.detectedTitle || '(sem título)',
    chapter.href || chapter.sourceHref || '',
    chapter.confidenceScore ?? chapter.confidence ?? ''
  ])).join('');
  const note = chapters.length > 80 ? `<div class="callout">Mostrando 80 de ${ui.escapeHtml(chapters.length)} capítulos detectados. O JSON técnico contém a lista completa.</div>` : '';
  return {
    id: 'chapters',
    label: 'Capítulos',
    icon: '🧩',
    title: 'Capítulos detectados',
    subtitle: 'Amostra da fonte recomendada ou mais completa disponível.',
    content: `${ui.card(null, null, ui.table(['Nº', 'Título', 'Arquivo', 'Confiança'], rows))}${note}`
  };
}

function sourcesPage(data, ui) {
  const rows = [
    sourceRow('spine', data.spine, data.recommended, ui),
    sourceRow('internal-dom', data.internal, data.recommended, ui)
  ].filter(Boolean).join('');
  if (!rows) return null;
  return {
    id: 'sources',
    label: 'Fontes de detecção',
    icon: '🔀',
    title: 'Fontes de detecção',
    subtitle: 'Comparação entre os relatórios gerados pela análise.',
    content: ui.card(null, null, ui.table(['Fonte', 'Capítulos', 'Documentos', 'Issues', 'Status'], rows))
  };
}

function divergencesPage(divergences, ui) {
  if (!divergences.length) return null;
  const rows = divergences.slice(0, 80).map((item) => ui.tableRow([
    item.type,
    item.chapter ?? '',
    item.source,
    item.message
  ])).join('');
  const note = divergences.length > 80 ? `<div class="callout">Mostrando 80 de ${ui.escapeHtml(divergences.length)} divergências. O JSON técnico contém a lista completa.</div>` : '';
  return {
    id: 'divergences',
    label: 'Divergências',
    icon: '⚠',
    title: 'Divergências de detecção',
    subtitle: 'Ausências, duplicidades, ordem e problemas reportados pelas fontes.',
    content: `${ui.card(null, null, ui.table(['Tipo', 'Capítulo', 'Fonte', 'Detalhe'], rows))}${note}`
  };
}

function sourceRow(label, report, recommended, ui) {
  if (!report) return '';
  const issueCount = (report.issues || []).length;
  const status = label === recommended ? ui.htmlCell('<span class="pill ok">✓ Recomendada</span>') : 'Disponível';
  return ui.tableRow([label, report.chapterCount, report.totalDocuments, issueCount, status]);
}

function chooseRecommendedSource({ internal, spine }) {
  if (internal?.ok && internal.chapterCount >= (spine?.chapterCount || 0)) return 'internal-dom';
  if (internal && internal.chapterCount > (spine?.chapterCount || 0)) return 'internal-dom';
  if (spine) return 'spine';
  if (internal) return 'internal-dom';
  return null;
}

function summarizeSequence(report) {
  const numbers = report?.sequence?.detectedNumbers || (report?.chapters || []).map((chapter) => chapter.chapterNumber).filter(Number.isFinite);
  return {
    range: numbers.length ? `${numbers[0]} → ${numbers.at(-1)}` : null,
    missingCount: report?.sequence?.missingChapters?.length ?? 0,
    duplicateCount: report?.sequence?.duplicateChapters?.length ?? 0,
    outOfOrderCount: report?.sequence?.outOfOrderChapters?.length ?? 0
  };
}

function collectDetectionDivergences({ internal, spine }) {
  const items = [];
  if (internal && spine && internal.chapterCount !== spine.chapterCount) {
    items.push({
      type: 'count_mismatch',
      source: 'spine × internal-dom',
      message: `${spine.chapterCount} no spine; ${internal.chapterCount} no internal-dom.`
    });
  }
  collectSequenceIssues(items, 'internal-dom', internal);
  collectSequenceIssues(items, 'spine', spine);
  collectReportIssues(items, 'internal-dom', internal);
  collectReportIssues(items, 'spine', spine);
  return items;
}

function collectSequenceIssues(items, source, report) {
  const sequence = report?.sequence;
  if (!sequence) return;
  for (const chapter of sequence.missingChapters || []) {
    items.push({ type: 'missing', chapter, source, message: `Capítulo ${chapter} ausente.` });
  }
  for (const chapter of sequence.duplicateChapters || []) {
    items.push({ type: 'duplicate', chapter, source, message: `Capítulo ${chapter} duplicado.` });
  }
  for (const item of sequence.outOfOrderChapters || []) {
    items.push({
      type: 'out_of_order',
      chapter: item.current?.number,
      source,
      message: `${item.current?.number || '?'} aparece depois de ${item.previous?.number || '?'}.`
    });
  }
}

function collectReportIssues(items, source, report) {
  for (const issue of report?.issues || []) {
    if (issue.code === 'INTERNAL_MISSING_CHAPTERS' || issue.code === 'INTERNAL_OUT_OF_ORDER_CHAPTERS') continue;
    items.push({
      type: issue.code || 'issue',
      chapter: issue.chapterNumber || '',
      source,
      message: issue.reason || issue.title || issue.href || JSON.stringify(issue).slice(0, 180)
    });
  }
}
