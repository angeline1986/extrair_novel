import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { createTerminal, clearScreen, printInfo, printMainMenu, printPrechapterMenu } from './terminal-ui.js';
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
import { writeJsonReport } from '../utils/report-writer.js';

process.on('SIGINT', () => {
  console.log('\nEncerrando menu.');
  process.exit(0);
});

async function runMenu() {
  const terminal = createTerminal();

  try {
    while (true) {
      clearScreen();
      printMainMenu();
      const choice = normalizeChoice(await terminal.ask('Escolha uma opção: '));

      if (choice === '0') {
        printInfo('Menu encerrado.');
        return;
      }

      if (choice === '1') {
        await analyzeEpubFromMenu(terminal);
        continue;
      }

      if (choice === '2') {
        await detectChaptersFromMenu(terminal);
        continue;
      }

      if (choice === '4') {
        await reviewChapterTitles(terminal);
        continue;
      }

      if (choice === '5') {
        await analyzeTocFromMenu(terminal);
        continue;
      }

      if (choice === '6') {
        await detectLanguageFromMenu(terminal);
        continue;
      }

      if (choice === '7') {
        await auditWithReferenceSource(terminal);
        continue;
      }

      if (choice === '8') {
        await showPrechapterPlaceholder(terminal);
        continue;
      }

      if (choice === '11') {
        terminal.close();
        const exitCode = await runFullPipeline();
        process.exitCode = exitCode;
        return;
      }

      if (choice === '12') {
        await browseReports(terminal);
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

async function analyzeEpubFromMenu(terminal) {
  clearScreen();
  const selected = await selectEpubForMenu(terminal);
  if (!selected) return;

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
  const reportPath = path.join(process.cwd(), 'reports', 'epub_analysis_report.json');
  await writeJsonReport(reportPath, report);

  printInfo(`Título: ${report.title || '(sem título)'}`);
  printInfo(`Idioma metadata: ${report.language || '(ausente)'}`);
  printInfo(`Manifest: ${report.manifestItems} itens`);
  printInfo(`Spine: ${report.spineItems} itens`);
  printInfo(`HTMLs lidos: ${report.htmlDocuments}`);
  printInfo(`TOC: ${report.tocEntries} entradas`);
  printInfo(`NAV: ${report.hasNav ? 'sim' : 'não'}; NCX: ${report.hasNcx ? 'sim' : 'não'}`);
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function detectChaptersFromMenu(terminal) {
  clearScreen();
  const selected = await selectEpubForMenu(terminal);
  if (!selected) return;

  const { epub, htmlDocs, tocReport } = readSelectedEpub(selected.path);
  const spineReport = detectChapters(epub, htmlDocs, tocReport, null);
  const internalReport = detectInternalChapters(epub, htmlDocs);
  const spinePath = path.join(process.cwd(), 'reports', 'spine_chapter_report.json');
  const internalPath = path.join(process.cwd(), 'reports', 'internal_chapter_report.json');
  await writeJsonReport(spinePath, spineReport);
  await writeJsonReport(internalPath, internalReport);

  printInfo(`Spine/canonical: ${spineReport.chapterCount} capítulos`);
  printInfo(`Internal-dom: ${internalReport.chapterCount} capítulos`);
  printInfo(`Internal-dom OK: ${internalReport.ok ? 'sim' : 'não'}`);
  if (spineReport.issues?.length) printInfo(`Issues spine/canonical: ${spineReport.issues.length}`);
  if (internalReport.issues?.length) printInfo(`Issues internal-dom: ${internalReport.issues.length}`);
  printInfo(`Relatório spine: ${path.relative(process.cwd(), spinePath)}`);
  printInfo(`Relatório internal-dom: ${path.relative(process.cwd(), internalPath)}`);
  await pause(terminal);
}

async function detectLanguageFromMenu(terminal) {
  clearScreen();
  const selected = await selectEpubForMenu(terminal);
  if (!selected) return;

  const { epub, htmlDocs } = readSelectedEpub(selected.path);
  const report = detectLanguage(epub, htmlDocs);
  const reportPath = path.join(process.cwd(), 'reports', 'language_report.json');
  await writeJsonReport(reportPath, report);

  printInfo(`Idioma metadata: ${report.metadataLanguage || '(ausente)'}`);
  printInfo(`Idioma detectado: ${report.detectedLanguage || '(indeterminado)'}`);
  printInfo(`Compatível: ${report.match ? 'sim' : 'não'}`);
  if (report.warning) printInfo('Warning: idioma metadata e idioma detectado divergem.');
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function analyzeTocFromMenu(terminal) {
  clearScreen();
  const selected = await selectEpubForMenu(terminal);
  if (!selected) return;

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
  const reportPath = path.join(process.cwd(), 'reports', 'toc_report.json');
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
  await pause(terminal);
}

async function reviewChapterTitles(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectSingleEpub(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected) return;

  const analysis = analyzeChapterTitles(selection.selected.path);
  printInfo(formatChapterTitlePreview(analysis));
  if (analysis.changed === 0) {
    printInfo('\nNenhuma normalização necessária.');
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nGerar cópia com títulos normalizados? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum arquivo novo foi gerado.');
    await pause(terminal);
    return;
  }

  const report = await normalizeChapterTitlesInCopy(selection.selected.path, analysis);
  const reportPath = writeChapterTitleNormalizationReport(process.cwd(), report);
  printInfo(`Status: ${report.status}`);
  if (report.outputFile) printInfo(`Cópia normalizada: ${path.relative(process.cwd(), report.outputFile)}`);
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function auditWithReferenceSource(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const target = await selectSingleEpub(terminal, inputDir);
  if (target.error) {
    printInfo(target.error);
    await pause(terminal);
    return;
  }
  if (target.cancelled || !target.selected) return;

  const reference = await selectReferenceSource(terminal, inputDir);
  if (reference.cancelled) return;
  const referenceDocument = reference.selected ? await loadReferenceSource(reference.selected.path) : null;
  const report = auditChapterIntegrity(target.selected.path, referenceDocument);
  const reportPath = writeChapterIntegrityReport(process.cwd(), report);
  printInfo(`\nStatus: ${report.status}`);
  printInfo(`Capítulos: ${report.chapterCount}`);
  printInfo(`Verificados: ${report.checkedChapters}`);
  printInfo(`Confiança: ${report.confidence}`);
  if (report.reference?.adapterStatus === 'unsupported') printInfo(`Referência unsupported: ${report.reference.sourceType}`);
  if (report.warnings.length) printInfo(`Warnings: ${report.warnings.map((warning) => warning.code).join(', ')}`);
  if (report.errors.length) printInfo(`Errors: ${report.errors.map((error) => error.code).join(', ')}`);
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function browseReports(terminal) {
  const reportsDir = path.join(process.cwd(), 'reports');
  while (true) {
    clearScreen();
    const reports = await listReports(reportsDir);
    if (!reports.length) {
      printInfo('Nenhum relatório encontrado em reports/.');
      await pause(terminal);
      return;
    }
    printReports(reports);
    const answer = normalizeChoice(await terminal.ask('Selecione um relatório ou 0 para voltar: '));
    if (answer === '0') return;
    const index = Number(answer);
    const selected = reports.find((report) => report.index === index);
    if (!selected) {
      printInfo('Seleção inválida.');
      await pause(terminal);
      continue;
    }
    clearScreen();
    printInfo(`${selected.category} / ${selected.name}\n`);
    printInfo(await previewReport(selected.path));
    await pause(terminal);
  }
}

async function showPrechapterPlaceholder(terminal) {
  while (true) {
    clearScreen();
    printPrechapterMenu();
    printInfo('M7: correção segura, merge, auditoria e normalização em fluxo orquestrado.');
    const choice = normalizeChoice(await terminal.ask('Escolha uma opção: '));

    if (choice === '0') return;

    if (choice === '1') {
      await analyzeSinglePrechapterEpub(terminal);
      continue;
    }

    if (choice === '2') {
      await fixSinglePrechapterEpub(terminal);
      continue;
    }

    if (choice === '3') {
      await fixMultiplePrechapterEpubs(terminal);
      continue;
    }

    if (choice === '4') {
      await analyzeMergePrecheck(terminal);
      continue;
    }

    if (choice === '5') {
      await mergeSelectedEpubs(terminal);
      continue;
    }

    if (choice === '6') {
      await correctAndMergeSelectedEpubs(terminal);
      continue;
    }

    printInfo('Opção inválida.');
    await pause(terminal);
  }
}

async function correctAndMergeSelectedEpubs(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  printInfo('\nEste fluxo automático só aceita fontes efetivas seguras: fixed ou already_clean.');
  const answer = normalizeChoice(await terminal.ask('Executar correção + merge + auditoria + títulos? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum EPUB final foi gerado.');
    await pause(terminal);
    return;
  }

  const typedTitle = normalizeChoice(await terminal.ask('\nTítulo final (Enter para sugerido): '));
  const normalizeTitlesAnswer = normalizeChoice(await terminal.ask('Normalizar títulos após o merge? [S/n] ')).toLowerCase();
  const normalizeTitles = !['n', 'nao', 'não', 'no'].includes(normalizeTitlesAnswer);
  const report = await runCorrectAndMergeWorkflow(selection.selected, {
    root: process.cwd(),
    title: typedTitle || undefined,
    normalizeTitles
  });
  printInfo(`\nStatus: ${report.status}`);
  if (report.blockedAt) printInfo(`Bloqueado em: ${report.blockedAt}`);
  if (report.finalOutputFile) printInfo(`Saída final: ${path.relative(process.cwd(), report.finalOutputFile)}`);
  printInfo(`Relatório: ${path.relative(process.cwd(), report.reportPath)}`);
  if (report.blockers?.length) {
    printInfo('\nFontes bloqueadas:');
    for (const blocker of report.blockers) printInfo(`${blocker.sourceFile}: ${blocker.status} (${blocker.reason})`);
  }
  await pause(terminal);
}

async function mergeSelectedEpubs(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  printInfo('\nExecutando precheck obrigatório...');
  const precheck = buildMergePrecheck(selection.selected);
  const precheckPath = await writeMergePrecheckReport(process.cwd(), precheck);
  printInfo(formatMergePrecheck(precheck));
  printInfo(`Relatório de precheck: ${path.relative(process.cwd(), precheckPath)}`);

  if (precheck.status !== 'ready_for_merge') {
    printInfo('\nMerge bloqueado pelo precheck. Nenhum EPUB foi gerado.');
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nGerar EPUB unido a partir dessa ordem? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum EPUB unido foi gerado.');
    await pause(terminal);
    return;
  }

  const suggestedTitle = suggestMergeTitle(precheck);
  const typedTitle = normalizeChoice(await terminal.ask(`\nTítulo final [${suggestedTitle}]: `));
  const report = mergeEpubs(precheck, { title: typedTitle || suggestedTitle });
  printInfo('\nMerge concluído.');
  printInfo(formatMergeResult(report));
  await pause(terminal);
}

async function analyzeMergePrecheck(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  printInfo('\nInventariando EPUBs selecionados...');
  const report = buildMergePrecheck(selection.selected);
  const reportPath = await writeMergePrecheckReport(process.cwd(), report);
  printInfo(formatMergePrecheck(report));
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function fixMultiplePrechapterEpubs(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectMultipleEpubs(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected.length) return;

  printInfo('\nAnalisando EPUBs selecionados...');
  const analysisBatch = await analyzePrechapterBatch(selection.selected, process.cwd());
  printBatchTable(analysisBatch);
  const analysisReport = await writePrechapterBatchReport(process.cwd(), analysisBatch);
  printInfo(`Relatório de análise: ${path.relative(process.cwd(), analysisReport)}`);

  if (analysisBatch.summary.eligible === 0) {
    printInfo('\nNenhum EPUB elegível para correção automática.');
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nAplicar correções seguras? [S/n] ')).toLowerCase();
  if (['n', 'nao', 'não', 'no'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum fixer foi chamado.');
    await pause(terminal);
    return;
  }

  const appliedBatch = await applyPrechapterBatch(analysisBatch, process.cwd());
  const batchReport = await writePrechapterBatchReport(process.cwd(), appliedBatch);
  printBatchTable(appliedBatch);
  printInfo(`Relatório batch: ${path.relative(process.cwd(), batchReport)}`);
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

async function fixSinglePrechapterEpub(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectSingleEpub(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected) return;

  const analysis = analyzePrechapterContent(selection.selected.path);
  printInfo(formatPrechapterPreview(analysis));
  if (analysis.status !== 'candidate_found' || analysis.confidence !== 'high') {
    printInfo('\nCorreção bloqueada: somente candidate_found com confiança HIGH pode ser aplicado automaticamente.');
    await pause(terminal);
    return;
  }

  const answer = normalizeChoice(await terminal.ask('\nGerar uma cópia removendo somente esse conteúdo? [S/N] ')).toLowerCase();
  if (!['s', 'sim', 'y', 'yes'].includes(answer)) {
    printInfo('Operação cancelada. Nenhum arquivo novo foi gerado.');
    await pause(terminal);
    return;
  }

  const fixReport = await fixPrechapterContent(selection.selected.path, analysis);
  const reportPath = await writePrechapterFixReport(process.cwd(), fixReport);
  if (fixReport.status === 'fixed') {
    printInfo(`Cópia corrigida: ${path.relative(process.cwd(), fixReport.outputFile)}`);
  } else {
    printInfo(`Correção não concluída: ${fixReport.blockReason || fixReport.status}`);
  }
  printInfo(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

async function analyzeSinglePrechapterEpub(terminal) {
  clearScreen();
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectSingleEpub(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return;
  }
  if (selection.cancelled || !selection.selected) return;

  const result = analyzePrechapterContent(selection.selected.path);
  const reportPath = await writePrechapterAnalysisReport(process.cwd(), result);
  printInfo(formatPrechapterPreview(result));
  printInfo(`\nRelatório: ${path.relative(process.cwd(), reportPath)}`);
  await pause(terminal);
}

function runFullPipeline() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/main.js'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      console.error(`Falha ao iniciar processamento completo: ${error.message}`);
      resolve(1);
    });
  });
}

async function pause(terminal) {
  await terminal.ask('\nPressione Enter para continuar...');
}

async function selectEpubForMenu(terminal) {
  const inputDir = path.join(process.cwd(), 'input');
  const selection = await selectSingleEpub(terminal, inputDir);
  if (selection.error) {
    printInfo(selection.error);
    await pause(terminal);
    return null;
  }
  if (selection.cancelled || !selection.selected) return null;
  return selection.selected;
}

function readSelectedEpub(epubPath) {
  const epub = readEpub(epubPath);
  const htmlDocs = readHtmlDocuments(epub);
  const tocReport = analyzeToc(epub);
  return { epub, htmlDocs, tocReport };
}

async function selectReferenceSource(terminal, inputDir) {
  const candidates = (await fs.readdir(inputDir))
    .filter((entry) => /\.(epub|pdf|docx)$/i.test(entry))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name, index) => ({ index: index + 1, name, path: path.join(inputDir, name) }));

  if (!candidates.length) {
    printInfo('\nNenhuma fonte de referência EPUB/PDF/DOCX encontrada em input/. A auditoria seguirá sem referência.');
    return { selected: null };
  }

  printInfo('\nFontes de referência encontradas:\n');
  for (const candidate of candidates) printInfo(`[${candidate.index}] ${candidate.name}`);
  printInfo('\n[Enter] sem referência');
  const answer = normalizeChoice(await terminal.ask('Selecione uma referência ou 0 para voltar: '));
  if (answer === '0') return { cancelled: true };
  if (!answer) return { selected: null };
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
