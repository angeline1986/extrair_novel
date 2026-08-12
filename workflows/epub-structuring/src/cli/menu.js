import fs from 'fs-extra';
import path from 'node:path';
import { createTerminal, clearScreen, formatPrompt, printInfo, printMainMenu, printPrechapterMenu, printSectionHeader } from './terminal-ui.js';
import { selectMultipleEpubs, selectSingleEpub } from './input-selector.js';
import { analyzePrechapterContent } from '../features/prechapter/prechapter-analyzer.js';
import { analyzePrechapterBatch, applyPrechapterBatch } from '../features/prechapter/prechapter-batch.js';
import { fixPrechapterContent } from '../features/prechapter/prechapter-fixer.js';
import { formatPrechapterPreview } from '../features/prechapter/prechapter-preview.js';
import { writePrechapterAnalysisReport, writePrechapterBatchReport, writePrechapterFixReport } from '../features/prechapter/prechapter-report.js';
import { buildMergePrecheck } from '../features/merge/merge-precheck.js';
import { formatMergePrecheck } from '../features/merge/merge-precheck-preview.js';
import { writeMergePrecheckReport } from '../features/merge/merge-precheck-report.js';
import { mergeEpubs } from '../features/merge/epub-merge.js';
import { formatMergeResult } from '../features/merge/merge-report.js';
import { suggestMergeTitle } from '../features/merge/merge-metadata.js';
import { runCorrectAndMergeWorkflow } from '../features/orchestration/full-workflow.js';
import { analyzeChapterTitles } from '../features/titles/chapter-title-analyzer.js';
import { formatChapterTitlePreview } from '../features/titles/chapter-title-preview.js';
import { normalizeChapterTitlesInCopy } from '../features/titles/chapter-title-fixer.js';
import { writeChapterTitleNormalizationReport } from '../features/titles/chapter-title-report.js';
import { auditChapterIntegrity } from '../features/reference/chapter-integrity-auditor.js';
import { writeChapterIntegrityReport } from '../features/reference/chapter-integrity-report.js';
import { loadReferenceSource } from '../features/reference/reference-loader.js';
import { readEpub } from '../parsers/epub-reader.js';
import { readHtmlDocuments } from '../parsers/html-reader.js';
import { analyzeToc } from '../analyzers/toc-analyzer.js';
import { detectChapters } from '../analyzers/chapter-detector.js';
import { detectInternalChapters } from '../analyzers/internal-chapter-discovery.js';
import { detectLanguage } from '../analyzers/language-detector.js';
import { analyzeStructure } from '../analyzers/structure-analyzer.js';
import { validateEpub3 } from '../validators/epub3-validator.js';
import { auditFinalEpub } from '../validators/final-epub-auditor.js';
import { runFinalRegressionValidation } from '../validators/final-regression-validator.js';
import { getValidationBaselinePath } from '../validators/validation-baseline.js';
import { writeJsonReport } from '../utils/report-writer.js';
import { createReportContext, finishReportContext } from '../utils/report-context.js';
import { buildReportPresentation, formatFindingForTerminal } from '../utils/report-findings.js';
import { formatReportRunLine, listReportRuns } from '../utils/report-index.js';
import { cleanReports, previewReportCleanup } from '../utils/report-cleaner.js';
import { openFile } from '../utils/file-opener.js';
import { runFullPipeline } from '../pipeline/full-pipeline.js';
import { getInputDirs } from '../utils/file-utils.js';

process.on('SIGINT', () => {
  console.log('\nEncerrando menu.');
  process.exit(0);
});

const MENU_OPTIONS = {
  1: { number: 1, title: 'Analisar EPUB', category: 'analysis' },
  2: { number: 2, title: 'Detectar capítulos', category: 'analysis' },
  3: { number: 3, title: 'Reestruturar capítulos', category: 'review' },
  4: { number: 4, title: 'Revisar títulos dos capítulos', category: 'review' },
  5: { number: 5, title: 'Analisar / reconstruir sumário', category: 'review' },
  6: { number: 6, title: 'Verificar idioma', category: 'analysis' },
  7: { number: 7, title: 'Usar fonte de referência', category: 'edit' },
  8: { number: 8, title: 'Corrigir conteúdo pré-capítulo', category: 'edit' },
  9: { number: 9, title: 'Converter / reconstruir como EPUB 3', category: 'edit' },
  10: { number: 10, title: 'Validar EPUB', category: 'system' },
  11: { number: 11, title: 'Processamento completo', category: 'system' },
  12: { number: 12, title: 'Ver relatórios', category: 'system' }
};

async function runMenu() {
  const terminal = createTerminal();

  try {
    while (true) {
      clearScreen();
      printMainMenu();
      const choice = normalizeChoice(await terminal.ask(formatPrompt('Escolha uma opção: ')));

      if (choice === '0') {
        printInfo('Menu encerrado.');
        return;
      }

      if (choice === '1') {
        await analyzeEpubFromMenu(terminal, MENU_OPTIONS[1]);
        continue;
      }

      if (choice === '2') {
        await detectChaptersFromMenu(terminal, MENU_OPTIONS[2]);
        continue;
      }

      if (choice === '3') {
        const executed = await runLegacyPipelineFromMenu(terminal, MENU_OPTIONS[3]);
        if (executed) return;
        continue;
      }

      if (choice === '4') {
        await reviewChapterTitles(terminal, MENU_OPTIONS[4]);
        continue;
      }

      if (choice === '5') {
        await analyzeTocFromMenu(terminal, MENU_OPTIONS[5]);
        continue;
      }

      if (choice === '6') {
        await detectLanguageFromMenu(terminal, MENU_OPTIONS[6]);
        continue;
      }

      if (choice === '7') {
        await auditWithReferenceSource(terminal, MENU_OPTIONS[7]);
        continue;
      }

      if (choice === '8') {
        await showPrechapterPlaceholder(terminal, MENU_OPTIONS[8]);
        continue;
      }

      if (choice === '9') {
        const executed = await runLegacyPipelineFromMenu(terminal, MENU_OPTIONS[9]);
        if (executed) return;
        continue;
      }

      if (choice === '10') {
        await validateEpubFromMenu(terminal, MENU_OPTIONS[10]);
        continue;
      }

      if (choice === '11') {
        const executed = await runFullPipelineSelectionFromMenu(terminal, MENU_OPTIONS[11]);
        if (executed) return;
        continue;
      }

      if (choice === '12') {
        await browseReports(terminal, MENU_OPTIONS[12]);
        continue;
      }

      if (isKnownOption(choice)) {
        printInfo('Ainda não implementado.');
        await pause(terminal);
        continue;
      }

      printInfo('Opção inválida.');
      await pause(terminal);
    }
  } finally {
    terminal.close();
  }
}

async function analyzeEpubFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const selectedEpubs = await selectEpubsForMenu(terminal);
  if (!selectedEpubs) return;

  await runForSelectedEpubs(selectedEpubs, async (selected, reportContext) => {
    const { epub, htmlDocs, tocReport } = readSelectedEpub(selected.path);
    const report = {
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(process.cwd(), selected.path),
      title: epub.opf.metadata.title || null,
      author: epub.opf.metadata.creator || null,
      language: epub.opf.metadata.language || null,
      identifier: epub.opf.metadata.identifier || null,
      manifestItems: epub.manifestItems.length,
      spineItems: epub.spineItems.length,
      htmlDocuments: htmlDocs.length,
      tocEntries: tocReport.entryCount || tocReport.entries?.length || 0,
      hasNav: tocReport.hasNav,
      hasNcx: tocReport.hasNcx,
      containerRootfile: epub.container.rootfilePath
    };
    const reportPath = path.join(reportContext.dataDir, 'epub_analysis_report.json');
    await writeJsonReport(reportPath, report);

    printInfo(`Título: ${report.title || '(sem título)'}`);
    printInfo(`Idioma metadata: ${report.language || '(ausente)'}`);
    printInfo(`Manifest: ${report.manifestItems} itens`);
    printInfo(`Spine: ${report.spineItems} itens`);
    printInfo(`HTMLs lidos: ${report.htmlDocuments}`);
    printInfo(`TOC: ${report.tocEntries} entradas`);
    printInfo(`NAV: ${report.hasNav ? 'sim' : 'não'}; NCX: ${report.hasNcx ? 'sim' : 'não'}`);
    printInfo('\nRelatórios:');
    printInfo(`  JSON: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function detectChaptersFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const selectedEpubs = await selectEpubsForMenu(terminal);
  if (!selectedEpubs) return;

  await runForSelectedEpubs(selectedEpubs, async (selected, reportContext) => {
    const { epub, htmlDocs, tocReport } = readSelectedEpub(selected.path);
    const spineReport = detectChapters(epub, htmlDocs, tocReport, null);
    const internalReport = detectInternalChapters(epub, htmlDocs);
    const spinePath = path.join(reportContext.dataDir, 'spine_chapter_report.json');
    const internalPath = path.join(reportContext.dataDir, 'internal_chapter_report.json');
    await writeJsonReport(spinePath, spineReport);
    await writeJsonReport(internalPath, internalReport);

    printInfo(`Spine/canonical: ${spineReport.chapterCount} capítulos`);
    printInfo(`Internal-dom: ${internalReport.chapterCount} capítulos`);
    printInfo(`Internal-dom OK: ${internalReport.ok ? 'sim' : 'não'}`);
    if (spineReport.issues?.length) printInfo(`Issues spine/canonical: ${spineReport.issues.length}`);
    if (internalReport.issues?.length) printInfo(`Issues internal-dom: ${internalReport.issues.length}`);
    printInfo(`Relatório spine: ${path.relative(process.cwd(), spinePath)}`);
    printInfo(`Relatório internal-dom: ${path.relative(process.cwd(), internalPath)}`);
  }, option);
  await pause(terminal);
}

async function detectLanguageFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const selectedEpubs = await selectEpubsForMenu(terminal);
  if (!selectedEpubs) return;

  await runForSelectedEpubs(selectedEpubs, async (selected, reportContext) => {
    const { epub, htmlDocs } = readSelectedEpub(selected.path);
    const report = detectLanguage(epub, htmlDocs);
    const reportPath = path.join(reportContext.dataDir, 'language_report.json');
    await writeJsonReport(reportPath, report);

    printInfo(`Idioma metadata: ${report.metadataLanguage || '(ausente)'}`);
    printInfo(`Idioma detectado: ${report.detectedLanguage || '(indeterminado)'}`);
    printInfo(`Compatível: ${report.match ? 'sim' : 'não'}`);
    if (report.warning) printInfo('Warning: idioma metadata e idioma detectado divergem.');
    printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function analyzeTocFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const selectedEpubs = await selectEpubsForMenu(terminal);
  if (!selectedEpubs) return;

  await runForSelectedEpubs(selectedEpubs, async (selected, reportContext) => {
    const { tocReport } = readSelectedEpub(selected.path);
    const report = {
      ...tocReport,
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(process.cwd(), selected.path),
      rebuild: {
        available: false,
        reason: 'M9.3 expõe somente análise. Reconstrução de nav.xhtml/toc.ncx deve passar por fluxo isolado seguro, sem mini-pipeline paralelo.'
      }
    };
    const reportPath = path.join(reportContext.dataDir, 'toc_report.json');
    await writeJsonReport(reportPath, report);

    printInfo(`NCX: ${report.hasNcx ? 'sim' : 'não'}`);
    printInfo(`NAV: ${report.hasNav ? 'sim' : 'não'}`);
    if (report.ncxPath) printInfo(`NCX path: ${report.ncxPath}`);
    printInfo(`Entradas: ${report.entryCount || report.entries?.length || 0}`);
    if (report.entries?.length) {
      printInfo('\nPrimeiras entradas:');
      for (const entry of report.entries.slice(0, 5)) {
        printInfo(`- ${entry.label || '(sem label)'} -> ${entry.src}`);
      }
    }
    printInfo('\nReconstrução: indisponível neste milestone.');
    printInfo('Motivo: requer fluxo isolado seguro de NAV/NCX/OPF, sem duplicar builders.');
    printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function validateEpubFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const selectedEpubs = await selectEpubsForMenu(terminal);
  if (!selectedEpubs) return;

  await runForSelectedEpubs(selectedEpubs, async (selected, reportContext) => {
    const { epub, htmlDocs, tocReport } = readSelectedEpub(selected.path);
    const languageReport = detectLanguage(epub, htmlDocs);
    const chapterReport = detectChapters(epub, htmlDocs, tocReport, null);
    const structureReport = analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport);
    const epub3Report = validateEpub3(structureReport, chapterReport, tocReport, languageReport);
    const packageAudit = runPackageAuditIfAvailable(selected.path);
    const regression = await runRegressionIfContextExists(selected.path);
    const report = buildMenuValidationReport({
      sourceFile: selected.path,
      epub3Report,
      structureReport,
      tocReport,
      chapterReport,
      packageAudit,
      regression
    });
    const reportPath = path.join(reportContext.dataDir, 'menu_epub_validation_report.json');
    await writeJsonReport(reportPath, report);

    printValidationSummary(report);
    printInfo(`\nRelatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function runLegacyPipelineFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  printInfo('Esta opção usa o pipeline legado completo via runFullPipeline().');
  printInfo('Ela preserva o contrato atual de npm start e exige exatamente um EPUB em input/.');
  printInfo('O menu não chama canonical-resplitter ou builders diretamente neste milestone.');
  const answer = normalizeChoice(await terminal.ask('\nExecutar pipeline completo agora? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum processamento foi iniciado.');
    await pause(terminal);
    return;
  }

  terminal.close();
  const exitCode = await runFullPipelineFromMenu();
  process.exitCode = exitCode;
  return true;
}

async function reviewChapterTitles(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  await runForSelectedEpubs(selection.selected, async (selected, reportContext) => {
    const analysis = analyzeChapterTitles(selected.path);
    printInfo(formatChapterTitlePreview(analysis));
    if (analysis.changed === 0) {
      printInfo('\nNenhuma normalização necessária.');
      return;
    }

    const answer = normalizeChoice(await terminal.ask('\nGerar cópia com títulos normalizados? [S/N] ')).toLowerCase();
    if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
      printInfo('Operação cancelada. Nenhum arquivo novo foi gerado.');
      return;
    }

    const report = await normalizeChapterTitlesInCopy(selected.path, analysis);
    const reportPath = writeChapterTitleNormalizationReport(process.cwd(), report, { reportContext });
    printInfo(`Status: ${report.status}`);
    if (report.outputFile) printInfo(`Cópia normalizada: ${path.relative(process.cwd(), report.outputFile)}`);
    printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function auditWithReferenceSource(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const { booksDir, referenceFilesDir } = getInputDirs(process.cwd());
  printInfo('Selecione o EPUB que deseja auditar:\n');
  const target = await selectSingleEpub(terminal, booksDir);
  if (target.error) {
    printInfo(target.error);
    await pause(terminal);
    return;
  }
  if (target.cancelled || !target.selected) return;

  printInfo(`EPUB selecionado:\n${target.selected.name}`);
  const reference = await selectReferenceSource(terminal, referenceFilesDir);
  if (reference.cancelled) return;
  const referenceDocument = reference.selected ? await loadReferenceSource(reference.selected.path) : null;
  await runForSelectedEpubs([target.selected], async (selected, reportContext) => {
    const report = auditChapterIntegrity(selected.path, referenceDocument);
    const reportPath = writeChapterIntegrityReport(process.cwd(), report, { reportContext });
    printInfo(`Status: ${report.status}`);
    printInfo(`Capítulos: ${report.chapterCount}`);
    printInfo(`Verificados: ${report.checkedChapters}`);
    printInfo(`Confiança: ${report.confidence}`);
    if (report.reference?.adapterStatus === 'unsupported') printInfo(`Referência unsupported: ${report.reference.sourceType}`);
    if (report.warnings.length) printInfo(`Warnings: ${report.warnings.map((warning) => warning.code).join(', ')}`);
    if (report.errors.length) printInfo(`Errors: ${report.errors.map((error) => error.code).join(', ')}`);
    printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function browseReports(terminal, option) {
  const reportsDir = path.join(process.cwd(), 'reports');
  while (true) {
    clearScreen();
    printSectionHeader(option);
    printInfo('12. VER RELATÓRIOS');
    printInfo('──────────────────────────────────────────────────────\n');
    printInfo('  [1] Abrir último relatório');
    printInfo('  [2] Selecionar relatório anterior');
    printInfo('  [3] Abrir pasta de relatórios');
    printInfo('  [4] Limpar relatórios');
    printInfo('  [0] Voltar\n');
    const answer = normalizeChoice(await terminal.ask('Escolha uma opção: '));
    if (answer === '0') return;

    if (answer === '1') {
      const runs = await listReportRuns(reportsDir);
      if (!runs.length) {
        printInfo('Nenhuma execução com data/run.json encontrada em reports/.');
        await pause(terminal);
        continue;
      }
      printReportRunOpenInfo(runs[0]);
      await pause(terminal);
      continue;
    }

    if (answer === '2') {
      await selectPreviousReportRun(terminal, reportsDir);
      continue;
    }

    if (answer === '3') {
      printInfo(`Pasta de relatórios: ${reportsDir}`);
      await pause(terminal);
      continue;
    }

    if (answer === '4') {
      await cleanReportsFromMenu(terminal);
      continue;
    }

    printInfo('Opção inválida.');
    await pause(terminal);
  }
}

async function cleanReportsFromMenu(terminal) {
  const preview = await previewReportCleanup(process.cwd());
  printInfo('\nLIMPAR RELATÓRIOS');
  printInfo('──────────────────────────────────────────────────────\n');
  printInfo(`Itens que seriam removidos: ${preview.entryCount}`);
  printInfo(`Espaço estimado: ${preview.formattedBytes}`);
  printInfo('Preservado: reports/.gitkeep');
  printInfo('Fora do escopo: input/ e output/\n');
  const answer = normalizeChoice(await terminal.ask('Confirmar limpeza de reports/? [s/N] '));
  if (answer !== 's' && answer !== 'S') {
    printInfo('Limpeza cancelada. Nenhum arquivo foi alterado.');
    await pause(terminal);
    return;
  }

  const result = await cleanReports(process.cwd(), { confirm: true });
  printInfo(`Relatórios removidos: ${result.deletedCount}`);
  printInfo(`Espaço liberado: ${result.formattedFreedBytes}`);
  await pause(terminal);
}

async function selectPreviousReportRun(terminal, reportsDir) {
  const runs = await listReportRuns(reportsDir);
  if (!runs.length) {
    printInfo('Nenhuma execução com data/run.json encontrada em reports/.');
    await pause(terminal);
    return;
  }

  clearScreen();
  printInfo('RELATÓRIOS DISPONÍVEIS');
  printInfo('──────────────────────────────────────────────────────\n');
  runs.forEach((run, index) => printInfo(formatReportRunLine(run, index + 1)));
  printInfo('\n  [0] Voltar\n');
  const answer = normalizeChoice(await terminal.ask('Selecione uma execução: '));
  if (answer === '0') return;
  const selected = runs[Number(answer) - 1];
  if (!selected) {
    printInfo('Seleção inválida.');
    await pause(terminal);
    return;
  }
  printReportRunOpenInfo(selected);
  await pause(terminal);
}

function printReportRunOpenInfo(run) {
  printInfo('Relatório selecionado:\n');
  printInfo(formatReportRunLine(run, 1).replace(/^  \[1\] /, '  '));
  printInfo(`\nHTML: ${path.relative(process.cwd(), run.reportHtml)}`);
  printInfo(`Dados: ${path.relative(process.cwd(), run.dataDir)}`);
}

async function showPrechapterPlaceholder(terminal, option) {
  while (true) {
    clearScreen();
    printSectionHeader(option);
    printPrechapterMenu();
    printInfo('M7: correção segura, merge, auditoria e normalização em fluxo orquestrado.');
    const choice = normalizeChoice(await terminal.ask('Escolha uma opção: '));

    if (choice === '0') return;

    if (choice === '1') {
      await analyzeSinglePrechapterEpub(terminal, option);
      continue;
    }

    if (choice === '2') {
      await fixSinglePrechapterEpub(terminal, option);
      continue;
    }

    if (choice === '3') {
      await fixMultiplePrechapterEpubs(terminal, option);
      continue;
    }

    if (choice === '4') {
      await analyzeMergePrecheck(terminal, option);
      continue;
    }

    if (choice === '5') {
      await mergeSelectedEpubs(terminal, option);
      continue;
    }

    if (choice === '6') {
      await correctAndMergeSelectedEpubs(terminal, option);
      continue;
    }

    printInfo('Opção inválida.');
    await pause(terminal);
  }
}

async function correctAndMergeSelectedEpubs(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  const reportContext = await createReportContext({
    root: process.cwd(),
    operation: `menu_option_${option.number}_correct_and_merge`,
    operationLabel: `${option.title}: correção + merge`,
    inputs: selection.selected.map((selected) => selected.path)
  });

  printInfo('\nEste fluxo automático só aceita fontes efetivas seguras: fixed ou already_clean.');
  const answer = normalizeChoice(await terminal.ask('Executar correção + merge + auditoria + títulos? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum EPUB final foi gerado.');
    await finishAndOpenReportContext(reportContext, { status: 'cancelled' });
    await pause(terminal);
    return;
  }

  const typedTitle = normalizeChoice(await terminal.ask('\nTítulo final (Enter para sugerido): '));
  const normalizeTitlesAnswer = normalizeChoice(await terminal.ask('Normalizar títulos após o merge? [S/n] ')).toLowerCase();
  const normalizeTitles = !['n', 'nao', 'não', 'no'].includes(normalizeTitlesAnswer);
  const report = await runCorrectAndMergeWorkflow(selection.selected, {
    root: process.cwd(),
    title: typedTitle || undefined,
    normalizeTitles,
    reportContext
  });
  printInfo(`\nStatus: ${report.status}`);
  if (report.blockedAt) printInfo(`Bloqueado em: ${report.blockedAt}`);
  if (report.finalOutputFile) printInfo(`Saída final: ${path.relative(process.cwd(), report.finalOutputFile)}`);
  printInfo(`Relatório: ${path.relative(process.cwd(), report.reportPath)}`);
  await finishAndOpenReportContext(reportContext, {
    status: report.status === 'success' ? 'success' : 'blocked',
    output: report.finalOutputFile || null
  });
  if (report.blockers?.length) {
    printInfo('\nFontes bloqueadas:');
    for (const blocker of report.blockers) printInfo(`${blocker.sourceFile}: ${blocker.status} (${blocker.reason})`);
  }
  await pause(terminal);
}

async function mergeSelectedEpubs(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  const reportContext = await createReportContext({
    root: process.cwd(),
    operation: `menu_option_${option.number}_merge`,
    operationLabel: `${option.title}: merge`,
    inputs: selection.selected.map((selected) => selected.path)
  });

  printInfo('\nExecutando precheck obrigatório...');
  const precheck = buildMergePrecheck(selection.selected);
  const precheckPath = await writeMergePrecheckReport(process.cwd(), precheck, { reportContext });
  printInfo(formatMergePrecheck(precheck));
  printInfo(`Relatório de precheck: ${path.relative(process.cwd(), precheckPath)}`);

  if (precheck.status !== 'ready_for_merge') {
    printInfo('\nMerge bloqueado pelo precheck. Nenhum EPUB foi gerado.');
    await finishAndOpenReportContext(reportContext, { status: 'blocked' });
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nGerar EPUB unido a partir dessa ordem? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum EPUB unido foi gerado.');
    await finishAndOpenReportContext(reportContext, { status: 'cancelled' });
    await pause(terminal);
    return;
  }

  const suggestedTitle = suggestMergeTitle(precheck);
  const typedTitle = normalizeChoice(await terminal.ask(`\nTítulo final [${suggestedTitle}]: `));
  const report = mergeEpubs(precheck, {
    title: typedTitle || suggestedTitle,
    reportFile: path.join(reportContext.dataDir, 'merge_report.json')
  });
  printInfo('\nMerge concluído.');
  printInfo(formatMergeResult(report));
  await finishAndOpenReportContext(reportContext, { status: 'success', output: report.outputFile || null });
  await pause(terminal);
}

async function analyzeMergePrecheck(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  const reportContext = await createReportContext({
    root: process.cwd(),
    operation: `menu_option_${option.number}_merge_precheck`,
    operationLabel: `${option.title}: precheck de merge`,
    inputs: selection.selected.map((selected) => selected.path)
  });

  printInfo('\nInventariando EPUBs selecionados...');
  const report = buildMergePrecheck(selection.selected);
  const reportPath = await writeMergePrecheckReport(process.cwd(), report, { reportContext });
  printInfo(formatMergePrecheck(report));
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await finishAndOpenReportContext(reportContext, { status: report.status === 'ready_for_merge' ? 'success' : 'blocked' });
  await pause(terminal);
}

async function fixMultiplePrechapterEpubs(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  const reportContext = await createReportContext({
    root: process.cwd(),
    operation: `menu_option_${option.number}_prechapter_batch`,
    operationLabel: `${option.title}: batch`,
    inputs: selection.selected.map((selected) => selected.path)
  });

  printInfo('\nAnalisando EPUBs selecionados...');
  const analysisBatch = await analyzePrechapterBatch(selection.selected, process.cwd());
  printBatchTable(analysisBatch);
  const analysisReport = await writePrechapterBatchReport(process.cwd(), analysisBatch, { reportContext });
  printInfo(`Relatório de análise: ${path.relative(process.cwd(), analysisReport)}`);

  if (analysisBatch.summary.eligible === 0) {
    printInfo('\nNenhum EPUB elegível para correção automática.');
    await finishAndOpenReportContext(reportContext, { status: 'blocked' });
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nAplicar correções seguras? [S/n] ')).toLowerCase();
  if (['n', 'nao', 'não', 'no'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum fixer foi chamado.');
    await finishAndOpenReportContext(reportContext, { status: 'cancelled' });
    await pause(terminal);
    return;
  }

  const appliedBatch = await applyPrechapterBatch(analysisBatch, process.cwd());
  const batchReport = await writePrechapterBatchReport(process.cwd(), appliedBatch, { reportContext });
  printBatchTable(appliedBatch);
  printInfo(`Relatório batch: ${path.relative(process.cwd(), batchReport)}`);
  await finishAndOpenReportContext(reportContext, { status: appliedBatch.summary.failed > 0 ? 'partial_success' : 'success' });
  await pause(terminal);
}

function printBatchTable(batch) {
  printInfo('');
  for (const item of batch.items) {
    const chapter = item.chapterNumber ? `cap. ${item.chapterNumber}` : 'cap. -';
    printInfo(`${item.sourceFile}  ${chapter}  ${String(item.status).toUpperCase()}`);
    if (item.error) printInfo(`  erro: ${item.error}`);
  }
  printInfo('');
  printInfo(`Selecionados: ${batch.selectedCount}`);
  printInfo(`Fixed: ${batch.summary.fixed}`);
  printInfo(`Already clean: ${batch.summary.alreadyClean}`);
  printInfo(`Ambiguous: ${batch.summary.ambiguous}`);
  printInfo(`No boundary: ${batch.summary.noBoundary}`);
  printInfo(`Unsupported: ${batch.summary.unsupported}`);
  printInfo(`Failed: ${batch.summary.failed}`);
}

async function fixSinglePrechapterEpub(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  await runForSelectedEpubs(selection.selected, async (selected, reportContext) => {
    const analysis = analyzePrechapterContent(selected.path);
    printInfo(formatPrechapterPreview(analysis));
    if (analysis.status !== 'candidate_found' || analysis.confidence !== 'high') {
      printInfo('\nCorreção bloqueada: somente candidate_found com confiança HIGH pode ser aplicado automaticamente.');
      return;
    }

    const answer = normalizeChoice(await terminal.ask('\nGerar uma cópia removendo somente esse conteúdo? [S/N] ')).toLowerCase();
    if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
      printInfo('Operação cancelada. Nenhum arquivo novo foi gerado.');
      return;
    }

    const fixReport = await fixPrechapterContent(selected.path, analysis);
    const reportPath = await writePrechapterFixReport(process.cwd(), fixReport, { reportContext });
    if (fixReport.status === 'fixed') {
      printInfo(`Cópia corrigida: ${path.relative(process.cwd(), fixReport.outputFile)}`);
    } else {
      printInfo(`Correção não concluída: ${fixReport.blockReason || fixReport.status}`);
    }
    printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function analyzeSinglePrechapterEpub(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  await runForSelectedEpubs(selection.selected, async (selected, reportContext) => {
    const result = analyzePrechapterContent(selected.path);
    const reportPath = await writePrechapterAnalysisReport(process.cwd(), result, { reportContext });
    printInfo(formatPrechapterPreview(result));
    printInfo(`\nRelatório: ${path.relative(process.cwd(), reportPath)}`);
  }, option);
  await pause(terminal);
}

async function runFullPipelineSelectionFromMenu(terminal, option) {
  clearScreen();
  printSectionHeader(option);
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectSingleEpub(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return false;
  }
  if (selection.cancelled || !selection.selected) return false;

  printInfo('\nArquivo selecionado:');
  printInfo(selection.selected.name);
  const answer = normalizeChoice(await terminal.ask('\nIniciar processamento completo? [S/n] ')).toLowerCase();
  if (['n', 'nao', 'não', 'no'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum processamento foi iniciado.');
    await pause(terminal);
    return false;
  }

  terminal.close();
  const exitCode = await runFullPipelineFromMenu({ epubPath: selection.selected.path });
  process.exitCode = exitCode;
  return true;
}

async function runFullPipelineFromMenu(options = {}) {
  try {
    const result = await runFullPipeline(process.cwd(), { log: console.log, ...options });
    await openHtmlReportFromMenu(result.reportContext);
    return 0;
  } catch (error) {
    console.error('Falha ao executar workflow.');
    console.error(error.message);
    return 1;
  }
}

async function pause(terminal) {
  await terminal.ask('\nPressione Enter para continuar...');
}

async function selectEpubsForMenu(terminal) {
  const inputDir = getInputDirs(process.cwd()).booksDir;
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return null;
  }
  if (selection.cancelled || !selection.selected.length) return null;
  return selection.selected;
}

function printSelectedSource(selected) {
  printInfo(`\nArquivo: ${path.relative(process.cwd(), selected.path)}`);
}

async function runForSelectedEpubs(selectedEpubs, worker, option = null) {
  const reportContext = option ? await createReportContext({
    root: process.cwd(),
    operation: `menu_option_${option.number}`,
    operationLabel: option.title,
    inputs: selectedEpubs.map((selected) => selected.path)
  }) : null;
  let hadErrors = false;

  for (const selected of selectedEpubs) {
    printSelectedSource(selected);
    try {
      await worker(selected, reportContext);
    } catch (error) {
      hadErrors = true;
      printInfo(`Erro em ${path.relative(process.cwd(), selected.path)}: ${error.message}`);
    }
  }

  if (reportContext) {
    await finishAndOpenReportContext(reportContext, { status: hadErrors ? 'partial_success' : 'success' });
  }
}

async function finishAndOpenReportContext(reportContext, options) {
  const finishedContext = await finishReportContext(reportContext, options);
  await openHtmlReportFromMenu(finishedContext);
  return finishedContext;
}

async function openHtmlReportFromMenu(reportContext) {
  if (!reportContext?.reportHtml) return;
  const relativeHtml = path.relative(process.cwd(), reportContext.reportHtml);
  printInfo(`  HTML: ${relativeHtml}`);
  const result = await openFile(reportContext.reportHtml);
  if (result.ok) {
    printInfo('\n✓ Relatório HTML aberto no navegador.');
    return;
  }
  printInfo('\n⚠ Não foi possível abrir o relatório automaticamente.');
  if (result.reason) printInfo(`Motivo: ${result.reason}`);
  printInfo(`Relatório disponível em: ${relativeHtml}`);
}

function readSelectedEpub(epubPath) {
  const epub = readEpub(epubPath);
  const htmlDocs = readHtmlDocuments(epub);
  const tocReport = analyzeToc(epub);
  return { epub, htmlDocs, tocReport };
}

function runPackageAuditIfAvailable(epubPath) {
  try {
    return { available: true, report: auditFinalEpub(epubPath) };
  } catch (error) {
    return {
      available: false,
      reason: `Auditoria final não aplicável a este EPUB isolado: ${error.message}`
    };
  }
}

async function runRegressionIfContextExists(epubPath) {
  const reportsDir = path.join(process.cwd(), 'reports');
  const baselinePath = getValidationBaselinePath(process.cwd());
  const relativeTarget = path.relative(process.cwd(), epubPath);
  if (!relativeTarget.startsWith(`output${path.sep}`)) {
    return {
      available: false,
      reason: 'Regressão exige EPUB final em output/ e baseline persistente aprovado.'
    };
  }

  if (!(await fs.pathExists(baselinePath))) {
    return {
      available: false,
      reason: 'Baseline persistente indisponível em input/validation-baseline/.'
    };
  }

  const report = runFinalRegressionValidation(reportsDir, epubPath, { baselinePath });
  const baselineCheck = report.checks.find((check) => check.code === 'VALIDATION_BASELINE');
  if (!baselineCheck?.ok) {
    return {
      available: false,
      reason: 'Baseline persistente indisponível ou inconsistente.',
      report
    };
  }
  return { available: true, report };
}

function buildMenuValidationReport({ sourceFile, epub3Report, structureReport, tocReport, chapterReport, packageAudit, regression }) {
  const packageValidation = packageAudit.available ? packageAudit.report.validation : null;
  const checks = [
    { label: 'Estrutura EPUB 3', ok: epub3Report.ok, source: 'validateEpub3' },
    { label: 'Manifest', ok: structureReport.summary.htmlItems > 0, source: 'analyzeStructure' },
    { label: 'Spine', ok: structureReport.summary.spineItems > 0, source: 'analyzeStructure' },
    { label: 'NAV', ok: tocReport.hasNav, source: 'analyzeToc', warningOnly: !tocReport.hasNav },
    { label: 'NCX', ok: tocReport.hasNcx, source: 'analyzeToc' },
    {
      label: 'XML/XHTML',
      ok: packageAudit.available ? packageAudit.report.xmlValidation.errors.length === 0 && packageAudit.report.xmlValidation.duplicateXmlDeclarations.length === 0 : null,
      source: 'auditFinalEpub',
      unavailableReason: packageAudit.available ? null : packageAudit.reason
    },
    { label: 'Capítulos', ok: chapterReport.chapterCount > 0 && !chapterReport.sequence.missingChapters.length, source: 'detectChapters' },
    {
      label: 'Regressão',
      ok: regression.available ? regression.report.ok : null,
      source: 'final-regression-validator',
      unavailableReason: regression.available ? null : regression.reason
    }
  ];
  const blockingFailures = checks.filter((check) => check.ok === false && !check.warningOnly);
  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), sourceFile),
    ok: blockingFailures.length === 0,
    result: blockingFailures.length === 0 ? 'OK' : 'FAILED',
    checks,
    epub3: epub3Report,
    packageAudit,
    regression,
    summary: {
      chapterCount: chapterReport.chapterCount,
      tocEntries: tocReport.entryCount || tocReport.entries?.length || 0,
      htmlItems: structureReport.summary.htmlItems,
      spineItems: structureReport.summary.spineItems,
      manifestEntries: packageValidation?.manifestEntries ?? null
    }
  };
}

function printValidationSummary(report) {
  printInfo('VALIDAÇÃO DO EPUB\n');
  const presentation = buildReportPresentation({ reports: { 'menu_epub_validation_report.json': report } });
  for (const finding of presentation.findings) {
    printInfo(formatFindingForTerminal(finding));
  }
  printInfo('\nRESULTADO');
  printInfo(`Status: ${presentation.result.status}`);
  printInfo('\nPRÓXIMAS AÇÕES SUGERIDAS');
  for (const action of presentation.actions) printInfo(`- ${action}`);
}

async function selectReferenceSource(terminal, inputDir) {
  await fs.ensureDir(inputDir);
  const candidates = (await fs.readdir(inputDir))
    .filter((entry) => /\.(epub|pdf|docx)$/i.test(entry))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name, index) => ({ index: index + 1, name, path: path.join(inputDir, name) }));

  const continueWithoutReference = candidates.length + 1;
  printInfo('\nSelecione a fonte usada para conferência:\n');
  if (!candidates.length) printInfo('  Nenhuma fonte EPUB/PDF/DOCX encontrada em input/reference-files/.');
  for (const candidate of candidates) printInfo(`  [${candidate.index}] ${candidate.name}`);
  printInfo(`\n  [${continueWithoutReference}] Continuar sem referência`);
  printInfo('  [0] Voltar\n');
  const answer = normalizeChoice(await terminal.ask('Selecione uma opção: '));
  if (answer === '0') return { cancelled: true };
  if (answer === String(continueWithoutReference)) return { selected: null };
  const selected = candidates.find((candidate) => candidate.index === Number(answer));
  if (!selected) {
    printInfo('Referência inválida. A auditoria seguirá sem referência.');
    return { selected: null };
  }
  return { selected };
}

async function listReports(reportsDir) {
  if (!(await fs.pathExists(reportsDir))) return [];
  const files = [];
  await collectReportFiles(reportsDir, reportsDir, files);
  return files
    .sort((a, b) => a.relative.localeCompare(b.relative, undefined, { numeric: true, sensitivity: 'base' }))
    .map((item, index) => ({
      index: index + 1,
      ...item,
      category: path.dirname(item.relative) === '.' ? 'root' : path.dirname(item.relative),
      name: path.basename(item.relative)
    }));
}

async function collectReportFiles(root, current, files) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectReportFiles(root, fullPath, files);
      continue;
    }
    if (!/\.(json|md|txt|html)$/i.test(entry.name)) continue;
    files.push({ path: fullPath, relative: path.relative(root, fullPath) });
  }
}

function printReports(reports) {
  printInfo('Relatórios encontrados:\n');
  let lastCategory = null;
  for (const report of reports) {
    if (report.category !== lastCategory) {
      lastCategory = report.category;
      printInfo(`[${lastCategory}]`);
    }
    printInfo(`  ${report.index}. ${report.name}`);
  }
  printInfo('');
}

async function previewReport(reportPath) {
  const content = await fs.readFile(reportPath, 'utf8');
  const text = path.extname(reportPath).toLowerCase() === '.json'
    ? formatJsonPreview(content)
    : content;
  return text.length > 4000 ? `${text.slice(0, 4000)}\n\n... preview truncado ...` : text;
}

function formatJsonPreview(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function normalizeChoice(value) {
  return String(value || '').trim();
}

function isKnownOption(choice) {
  return ['1', '2', '3', '4', '5', '6', '7', '9', '10', '12'].includes(choice);
}

runMenu().catch((error) => {
  console.error('Falha ao executar menu.');
  console.error(error.message);
  process.exit(1);
});
