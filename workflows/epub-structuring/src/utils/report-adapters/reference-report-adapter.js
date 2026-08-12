export function buildReferencePages(model, ui) {
  const report = model.reports['chapter_integrity_report.json'];
  if (model.run?.operation !== 'menu_option_7') return [];
  if (!report) return [];
  const divergences = collectReferenceDivergences(report);

  return [
    overviewPage(report, divergences, ui),
    referencePage(report, ui),
    matchesPage(report, ui),
    divergencesPage(divergences, ui),
    chaptersPage(report, ui)
  ].filter(Boolean);
}

function overviewPage(report, divergences, ui) {
  const metrics = [
    ui.metric('Capítulos EPUB', report.chapterCount, 'detectados no alvo'),
    ui.metric('Capítulos referência', report.reference?.chapterCount, report.reference?.sourceType || 'referência'),
    ui.metric('Verificados', report.checkedChapters, 'capítulos comparados'),
    ui.metric('Divergências', divergences.length, 'issues reportadas')
  ].filter(Boolean).join('');
  const rows = [
    ui.tableRow(['Status', report.status]),
    ui.tableRow(['Modo', report.mode]),
    ui.tableRow(['Confiança', report.confidence]),
    ui.tableRow(['Warnings', report.warnings?.length ?? 0]),
    ui.tableRow(['Errors', report.errors?.length ?? 0])
  ].filter(Boolean).join('');
  return {
    id: 'overview',
    label: 'Visão geral',
    icon: '📊',
    title: 'Auditoria com fonte de referência',
    subtitle: report.targetEpub || 'Resultado da comparação estrutural.',
    content: `${metrics ? `<div class="metric-grid">${metrics}</div>` : ''}${rows ? ui.card('Resultado da auditoria', null, ui.table(['Item', 'Valor'], rows)) : ''}`
  };
}

function referencePage(report, ui) {
  const ref = report.reference;
  if (!ref) return null;
  const rows = [
    ui.tableRow(['Tipo', ref.sourceType]),
    ui.tableRow(['Arquivo', ref.sourceFile]),
    ui.tableRow(['Status do adapter', ref.adapterStatus]),
    ui.tableRow(['Capítulos', ref.chapterCount]),
    ui.tableRow(['Idioma', ref.language]),
    ui.tableRow(['Título', ref.title])
  ].filter(Boolean).join('');
  return {
    id: 'reference',
    label: 'Fonte de referência',
    icon: '📄',
    title: 'Fonte de referência',
    subtitle: 'Arquivo usado como expectativa externa quando disponível.',
    content: ui.card(null, null, ui.table(['Campo', 'Valor'], rows))
  };
}

function matchesPage(report, ui) {
  const chapters = report.chapters || [];
  if (!chapters.length && report.checkedChapters === 0) {
    return {
      id: 'matches',
      label: 'Correspondências',
      icon: '🔗',
      title: 'Correspondências',
      subtitle: 'Nenhum capítulo foi comparado nesta execução.',
      content: ui.card(null, null, '<div class="callout">A auditoria não teve capítulos verificados. Consulte a página de divergências para o motivo.</div>')
    };
  }
  const rows = chapters.slice(0, 80).map((chapter) => ui.tableRow([
    chapter.chapterNumber || chapter.number || '',
    chapter.status || chapter.match || '',
    chapter.epubTitle || chapter.title || '',
    chapter.referenceTitle || chapter.expectedTitle || ''
  ])).join('');
  return {
    id: 'matches',
    label: 'Correspondências',
    icon: '🔗',
    title: 'Correspondências',
    subtitle: 'Capítulos comparados entre EPUB e referência.',
    content: ui.card(null, null, rows ? ui.table(['Capítulo', 'Status', 'EPUB', 'Referência'], rows) : '<div class="callout">Sem linhas de correspondência disponíveis no JSON técnico.</div>')
  };
}

function divergencesPage(divergences, ui) {
  if (!divergences.length) return null;
  const rows = divergences.slice(0, 120).map((item) => ui.tableRow([
    item.severity,
    item.type,
    item.chapter ?? '',
    item.found ?? '',
    item.expected ?? '',
    item.message
  ])).join('');
  return {
    id: 'divergences',
    label: 'Divergências',
    icon: '⚠',
    title: 'Divergências',
    subtitle: 'Warnings, errors e diferenças encontradas pela auditoria.',
    content: ui.card(null, null, ui.table(['Severidade', 'Tipo', 'Capítulo', 'Encontrado', 'Esperado', 'Detalhe'], rows))
  };
}

function chaptersPage(report, ui) {
  const chapters = report.chapters || [];
  if (!chapters.length) return null;
  const rows = chapters.slice(0, 80).map((chapter) => ui.tableRow([
    chapter.chapterNumber || chapter.number || '',
    chapter.title || chapter.epubTitle || '',
    chapter.href || '',
    chapter.status || ''
  ])).join('');
  return {
    id: 'chapters',
    label: 'Capítulos',
    icon: '📚',
    title: 'Capítulos auditados',
    subtitle: 'Amostra dos capítulos disponíveis no relatório técnico.',
    content: ui.card(null, null, ui.table(['Nº', 'Título', 'Arquivo', 'Status'], rows))
  };
}

function collectReferenceDivergences(report) {
  const items = [];
  collectList(items, 'error', 'Erro', report.errors);
  collectList(items, 'warning', 'Warning', report.warnings);
  collectList(items, 'problem', 'Estrutural', report.structuralIssues);
  collectList(items, 'problem', 'Boundary', report.boundaryIssues);
  collectList(items, 'problem', 'Conteúdo ausente', report.missingContent);
  collectList(items, 'problem', 'Conteúdo duplicado', report.duplicatedContent);
  collectList(items, 'problem', 'Mismatch', report.chapterMismatches);
  return items;
}

function collectList(items, severity, type, list = []) {
  for (const item of list || []) {
    items.push({
      severity,
      type: item.code || type,
      chapter: item.chapterNumber || item.chapter || item.number || '',
      found: item.found || item.actual || item.epubTitle || item.target || '',
      expected: item.expected || item.referenceTitle || item.reference || '',
      message: item.error || item.message || item.reason || item.code || JSON.stringify(item).slice(0, 180)
    });
  }
}
