import { spawn } from 'node:child_process';
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
