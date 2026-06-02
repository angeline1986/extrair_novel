#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { fixEpub } from './fixEpub.js';
import { applyApprovedPdfEpubFindings as applyApprovedPdfEpubFindingsToEpub } from './applyPdfEpubApprovedFindings.js';
import { runPdfEpubComparisonReport as generatePdfEpubComparisonReport } from './auditPdfEpubReport.js';
import {
  buildPdfEpubReviewQueue,
  refreshPdfEpubReviewQueueSummary,
} from './pdfEpubReviewQueue.js';
import {
  filterPendingItems,
  pendingCategoryOptions,
} from './pdfEpubComparison/menuReviewFilters.js';
import {
  findLatestDecisionExport,
  importPdfEpubDecisions,
} from './pdfEpubComparison/importDecisions.js';
import {
  applyReviewDecision,
  decisionOptionsForItem,
  replacementForDecision,
} from './pdfEpubComparison/reviewDecision.js';
import { writePdfEpubComparisonFullText } from './pdfEpubComparisonReportWriter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(workflowRoot, '../..');
const logsDir = path.join(workflowRoot, 'logs');
const stateDir = path.join(workflowRoot, 'state');
const reportsDir = path.join(workflowRoot, 'reports');
const inputFixedDir = path.join(workflowRoot, 'input-fixed');
const outputDir = path.join(workflowRoot, 'output');
const reportsTxtDir = path.join(reportsDir, 'txt');
const reportsJsonDir = path.join(reportsDir, 'json');
const reportsHtmlDir = path.join(reportsDir, 'html');
const summaryPath = path.join(reportsTxtDir, 'epub-audit-summary-latest.txt');
const reportPattern = path.join(reportsJsonDir, 'audit-report-*.json');
const readerReportPath = path.join(reportsHtmlDir, 'reader-report-latest.html');
const reviewQueuePath = path.join(stateDir, 'review-queue.json');
const assistedReviewPath = path.join(stateDir, 'assisted-review-suggestions.json');
const pdfEpubComparisonStatePath = path.join(stateDir, 'pdf-epub-comparison.json');
const pdfEpubReviewQueuePath = path.join(stateDir, 'pdf-epub-review-queue.json');
const pdfEpubComparisonFullTxtPath = path.join(reportsTxtDir, 'pdf-epub-comparison-full.txt');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function color(text, name = 'reset') {
  return `${colors[name] || ''}${text}${colors.reset}`;
}

function log(message, name = 'reset') {
  console.log(color(message, name));
}

function displayPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

function getLanguageName(code) {
  const names = { en: 'Inglês', es: 'Espanhol' };
  return names[code] || code.toUpperCase();
}

function printHeader() {
  console.clear();
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                  AUDITORIA DE TRADUCAO EPUB                   ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Compara EPUB original + portugues e usa Log_Traducao.txt     ║', 'cyan');
  log('║  como insumo para validar termos, trocas e pendencias.         ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Relatorio principal: reader-report-latest.html                 ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();

  log('📋 ESCOLHA UMA OPCAO:', 'yellow');
  console.log();

  log('  ┌───────────── FLUXO PRINCIPAL ─────────────┐', 'dim');
  log('  1. 🚀 Gerar versão revisada da tradução', 'green');
  log('     Audita + aplica correções seguras + valida + reaudita + gera relatórios', 'dim');
  console.log();

  log('  ┌───────────── RELATÓRIOS ────────────┐', 'dim');
  log('  2. 📄 Gerar relatório PDF x EPUB', 'white');
  log('     Compara PDF original com EPUB traduzido/validado', 'dim');
  log('  3. 📋 Exportar lista completa de achados', 'white');
  log('     Gera TXT completo a partir do JSON PDF x EPUB', 'dim');
  log('  4. 🗑️  Limpar relatórios antigos', 'red');
  console.log();

  log('  ┌───────────── REVISÃO EDITORIAL ─────┐', 'dim');
  log('  5. ✅ Fluxo de Revisão', 'cyan');
  log('     Auditoria EPUB ou achados PDF x EPUB', 'dim');
  log('  6. 👀 Ver itens que precisam de leitura/contexto', 'cyan');
  log('     Mostra pendências sem sugestão segura', 'dim');
  console.log();

  log('  ┌───────────── MANUTENÇÃO ─────────────┐', 'dim');
  log('  7. 🧹 Limpar auditoria recente', 'red');
  log('     Remove relatórios/logs e achados temporários; preserva versões auditadas', 'dim');
  log('  8. 🧨 Limpar Tudo - Iniciar nova Obra', 'red');
  log('     Remove estado gerado, input-fixed e output; preserva arquivos de entrada', 'dim');
  console.log();

  log('  ┌───────────── AUDITORIA ─────────────┐', 'dim');
  log('  9. 🔍 Auditar tradução atual', 'white');
  log('  10. 🔍📋 Auditar tradução atual com detalhes', 'white');
  console.log();

  log('  ┌───────────── SISTEMA ───────────────┐', 'dim');
  log('  11. ❌ Sair', 'magenta');
  console.log();
  console.log('─'.repeat(64));
  console.log();
}

function runAudit({ verbose = false, sourceLanguage } = {}) {
  const args = ['workflows/audit-translation-epub/src/audit.js'];
  if (verbose) args.push('--verbose');
  if (sourceLanguage) args.push(`--source-language=${sourceLanguage}`);

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  return result.status || 0;
}

function runAuditForFile(filePath, { verbose = false } = {}) {
  const args = [
    'workflows/audit-translation-epub/src/audit.js',
    `--translated=${filePath}`,
  ];
  if (verbose) args.push('--verbose');

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  return result.status || 0;
}

function runPdfEpubComparisonReport() {
  const result = spawnSync(process.execPath, ['workflows/audit-translation-epub/src/auditPdfEpubReport.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  return result.status || 0;
}

function exportPdfEpubFullFindings() {
  if (!fs.existsSync(pdfEpubComparisonStatePath)) {
    log(`\nJSON PDF x EPUB ainda nao existe: ${displayPath(pdfEpubComparisonStatePath)}`, 'yellow');
    log('Gere o relatorio PDF x EPUB primeiro.', 'dim');
    return;
  }

  const audit = readJson(pdfEpubComparisonStatePath, null);
  if (!audit) {
    log('\nNao foi possivel ler o JSON PDF x EPUB.', 'red');
    return;
  }

  writePdfEpubComparisonFullText(audit, pdfEpubComparisonFullTxtPath);
  log(`\nLista completa exportada: ${displayPath(pdfEpubComparisonFullTxtPath)}`, 'green');
  log(`JSON completo: ${displayPath(pdfEpubComparisonStatePath)}`, 'cyan');
}

async function generatePdfEpubComparisonReportFromMenu({ warnOnly = false } = {}) {
  try {
    const htmlPath = await generatePdfEpubComparisonReport();
    log(`Relatorio PDF x EPUB: ${displayPath(htmlPath)}`, 'cyan');
    return true;
  } catch (error) {
    const message = `Relatorio PDF x EPUB nao gerado: ${error.message}`;
    if (!warnOnly) throw new Error(message);
    log(message, 'yellow');
    return false;
  }
}

async function selectSourceLanguage() {
  console.log();
  log('Selecione o idioma de origem:', 'yellow');
  log('  1. Inglês (en)', 'white');
  log('  2. Espanhol (es)', 'white');
  console.log();

  const choice = (await ask(color('Opcao (1/2): ', 'yellow'))).trim();

  if (choice === '1') {
    return 'en';
  } else if (choice === '2') {
    return 'es';
  } else {
    log('Opcao invalida. Usando ingles como padrao.', 'yellow');
    return 'en';
  }
}

async function runRevisionWorkflow() {
  console.log();
  log('1/4 Selecionar idioma de origem', 'cyan');
  const sourceLanguage = await selectSourceLanguage();

  console.log();
  log('2/4 Auditoria da traducao atual', 'cyan');
  runAudit({ sourceLanguage });

  console.log();
  log('3/4 Gerando EPUB revisado, validando e reauditando', 'cyan');
  const report = await fixEpub();
  log(`Versao criada: ${report.version}`, 'green');
  log(`Substituicoes aplicadas: ${report.totalReplacements}`, 'green');
  log(
    `Pacote EPUB: mimetype primeiro=${report.packageValidation.mimetypeFirst ? 'sim' : 'nao'}, container=${report.packageValidation.hasContainer ? 'ok' : 'ausente'}`,
    report.packageValidation.mimetypeFirst && report.packageValidation.hasContainer ? 'green' : 'yellow'
  );
  log(`Arquivo final: ${displayPath(report.finalPath)}`, 'cyan');
  if (report.reauditoria) {
    log(
      `Reauditoria: ${report.reauditoria.result} | issues ${report.reauditoria.issuesBefore} -> ${report.reauditoria.issuesAfter} | warnings ${report.reauditoria.warningsBefore} -> ${report.reauditoria.warningsAfter}`,
      report.reauditoria.result === 'regression' ? 'yellow' : 'green'
    );
  }

  console.log();
  log('4/4 Gerando relatorio PDF x EPUB', 'cyan');
  await generatePdfEpubComparisonReportFromMenu({ warnOnly: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeText(value, limit = 700) {
  const text = String(value || '-').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function visibleLength(value) {
  return String(value || '').length;
}

function fitCell(value, width) {
  const text = String(value || '');
  if (visibleLength(text) <= width) return text.padEnd(width, ' ');
  return `${text.slice(0, Math.max(0, width - 3))}...`;
}

function wrapText(value, width) {
  const words = normalizeText(value, 4000).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (visibleLength(`${current} ${word}`) <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function printBox(lines, width = 67) {
  console.log(`┌${'─'.repeat(width + 2)}┐`);
  for (const line of lines) {
    console.log(`│ ${fitCell(line, width)} │`);
  }
  console.log(`└${'─'.repeat(width + 2)}┘`);
}

function chapterLabelFromReviewItem(item) {
  if (Number.isInteger(item?.spineIndex)) return `Capitulo ${item.spineIndex + 1}`;
  const fileMatch = String(item?.filePath || '').match(/chapter_(\d+)/i);
  if (fileMatch) return `Capitulo ${Number(fileMatch[1])}`;
  return null;
}

function printSuggestionBox({ id, type, file, chapter, currentText, before, after }) {
  const width = 67;
  const leftWidth = 27;
  const rightWidth = width - leftWidth - 3;
  const currentLines = wrapText(currentText, width);
  const beforeLines = wrapText(before, leftWidth);
  const afterLines = wrapText(after, rightWidth);
  const rows = Math.max(beforeLines.length, afterLines.length);

  console.log(`┌${'─'.repeat(width + 2)}┐`);
  console.log(`│ ${fitCell(`SUGESTAO ${id}`, width)} │`);
  console.log(`│ ${fitCell(type, width)} │`);
  if (chapter) console.log(`│ ${fitCell(chapter, width)} │`);
  console.log(`│ ${fitCell(`Arquivo: ${file}`, width)} │`);
  console.log(`├${'─'.repeat(width + 2)}┤`);
  console.log(`│ ${fitCell('TRECHO ATUAL', width)} │`);
  for (const line of currentLines) console.log(`│ ${fitCell(line, width)} │`);
  console.log(`├${'─'.repeat(leftWidth + 2)}┬${'─'.repeat(rightWidth + 2)}┤`);
  console.log(`│ ${fitCell('ANTES', leftWidth)} │ ${fitCell('SUGESTAO', rightWidth)} │`);
  console.log(`├${'─'.repeat(leftWidth + 2)}┼${'─'.repeat(rightWidth + 2)}┤`);
  for (let index = 0; index < rows; index++) {
    console.log(`│ ${fitCell(beforeLines[index] || '', leftWidth)} │ ${fitCell(afterLines[index] || '', rightWidth)} │`);
  }
  console.log(`└${'─'.repeat(leftWidth + 2)}┴${'─'.repeat(rightWidth + 2)}┘`);
}

function printEpubSuggestionOptions(before, after) {
  log('OPCOES', 'cyan');
  log(`  1. ${normalizeText(before, 120)}`, 'white');
  log(`  2. ${normalizeText(after, 120)}`, 'white');
  log('  P. Pular', 'white');
  log('  S. Sair', 'white');
  console.log();
}

function printKeyValueBox(rows) {
  const labelWidth = 15;
  const valueWidth = 72;
  console.log(`┌${'─'.repeat(labelWidth + 2)}┬${'─'.repeat(valueWidth + 2)}┐`);
  rows.forEach((row, index) => {
    const values = wrapText(row.value, valueWidth);
    if (index > 0 && row.separator !== false) {
      console.log(`├${'─'.repeat(labelWidth + 2)}┼${'─'.repeat(valueWidth + 2)}┤`);
    }
    values.forEach((line, lineIndex) => {
      console.log(`│ ${fitCell(lineIndex === 0 ? row.label : '', labelWidth)} │ ${fitCell(line, valueWidth)} │`);
    });
  });
  console.log(`└${'─'.repeat(labelWidth + 2)}┴${'─'.repeat(valueWidth + 2)}┘`);
}

function printIfPresent(title, value, limit = 1000) {
  if (!value) return;
  console.log();
  log(title, 'dim');
  console.log(normalizeText(value, limit));
}

function humanType(type = '') {
  if (/gender|agreement/.test(type)) return 'Possivel ajuste de concordancia';
  if (/treatment/.test(type)) return 'Possivel ajuste de tratamento';
  if (/terminolog/.test(type)) return 'Possivel ajuste de termo';
  if (/residual_english/.test(type)) return 'Possivel trecho em ingles';
  if (/repetition/.test(type)) return 'Possivel repeticao';
  if (/literal/.test(type)) return 'Possivel frase literal';
  return 'Sugestao de revisao';
}

function refreshReviewQueueSummary(reviewQueue) {
  const items = reviewQueue.items || [];
  reviewQueue.summary = {
    ...(reviewQueue.summary || {}),
    totalItems: items.length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    pending: items.filter((item) => item.status === 'pending').length,
    needsContext: items.filter((item) => item.status === 'needs_context').length,
  };
}

function availableSuggestions(reviewQueue, assistedReview) {
  const itemById = new Map((reviewQueue.items || []).map((item) => [item.id, item]));
  return (assistedReview.suggestions || [])
    .map((suggestion) => ({ suggestion, item: itemById.get(suggestion.reviewQueueItemId) }))
    .filter(({ suggestion, item }) => item &&
      item.status === 'pending' &&
      suggestion.suggestionStatus === 'suggestion_available' &&
      (suggestion.suggestedAfter || suggestion.replacementAfter) &&
      (suggestion.before || suggestion.targetBefore || item.before));
}

async function reviewReadySuggestions() {
  const reviewQueue = readJson(reviewQueuePath);
  const assistedReview = readJson(assistedReviewPath);

  if (!reviewQueue || !assistedReview) {
    log('\nFila de revisao ainda nao existe. Rode a auditoria primeiro.', 'yellow');
    return;
  }

  const candidates = availableSuggestions(reviewQueue, assistedReview);
  if (!candidates.length) {
    log('\nNenhuma sugestao pronta para aprovacao rapida nesta rodada.', 'yellow');
    log(`Relatorio editorial: ${displayPath(readerReportPath)}`, 'dim');
    return;
  }

  let approved = 0;
  let rejected = 0;
  let skipped = 0;

  for (const { suggestion, item } of candidates) {
    const before = suggestion.before || suggestion.targetBefore || item.before;
    const after = suggestion.suggestedAfter || suggestion.replacementAfter;
    console.log();
    printSuggestionBox({
      id: item.id,
      type: humanType(suggestion.type || item.type),
      file: `${item.filePath || '-'} · ${item.nodeId || '-'}`,
      chapter: chapterLabelFromReviewItem(item),
      currentText: suggestion.currentParagraph || item.currentParagraph || item.textPreview,
      before,
      after,
    });
    console.log();
    printEpubSuggestionOptions(before, after);

    const answer = (await ask(color('Escolha uma opcao: ', 'yellow'))).trim().toLowerCase();
    const now = new Date().toISOString();

    if (answer === 's' || answer === 'sair') break;
    if (answer === '2' || answer === 'a' || answer === 'aprovar') {
      item.status = 'approved';
      item.before = before;
      item.after = after;
      item.review = {
        ...(item.review || {}),
        source: 'menu_review',
        suggestionId: suggestion.id || null,
        approvedAt: now,
        reviewedAt: now,
        notes: 'Aprovado pelo menu interativo EPUB.',
      };
      approved += 1;
      refreshReviewQueueSummary(reviewQueue);
      writeJson(reviewQueuePath, reviewQueue);
      log('Sugestao aprovada.', 'green');
    } else if (answer === '1' || answer === 'd' || answer === 'descartar' || answer === 'm' || answer === 'manter' || answer === 'r' || answer === 'rejeitar') {
      item.status = 'rejected';
      item.review = {
        ...(item.review || {}),
        source: 'menu_review',
        suggestionId: suggestion.id || null,
        reviewedAt: now,
        notes: 'Sugestao descartada pelo menu interativo EPUB.',
      };
      rejected += 1;
      refreshReviewQueueSummary(reviewQueue);
      writeJson(reviewQueuePath, reviewQueue);
      log('Sugestao descartada.', 'yellow');
    } else {
      skipped += 1;
      log('Sugestao pulada.', 'dim');
    }
  }

  refreshReviewQueueSummary(reviewQueue);
  writeJson(reviewQueuePath, reviewQueue);

  console.log();
  log(`Revisao concluida: ${approved} aprovadas, ${rejected} descartadas, ${skipped} puladas.`, 'cyan');

  if (!approved) return;

  const runFix = (await ask(color('Gerar EPUB revisado agora com as sugestoes aprovadas? (S/N): ', 'yellow'))).trim().toLowerCase();
  if (runFix !== 's' && runFix !== 'sim' && runFix !== 'y') {
    log('Aprovacoes salvas. Rode a correcao quando quiser gerar o EPUB.', 'dim');
    return;
  }

  const validation = spawnSync(process.execPath, ['workflows/audit-translation-epub/src/validateReviewQueue.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (validation.status !== 0) {
    log('Validacao da review queue falhou. EPUB nao sera gerado.', 'red');
    return;
  }

  const report = await fixEpub();
  log(`EPUB revisado gerado: ${displayPath(report.finalPath)}`, 'green');
  log(`Correcoes aplicadas: ${report.appliedCorrections}`, 'green');
}

async function viewContextItems() {
  const reviewQueue = readJson(reviewQueuePath);
  const assistedReview = readJson(assistedReviewPath);

  if (!reviewQueue || !assistedReview) {
    log('\nFila de revisao ainda nao existe. Rode a auditoria primeiro.', 'yellow');
    return;
  }

  const itemById = new Map((reviewQueue.items || []).map((item) => [item.id, item]));
  const items = (assistedReview.suggestions || [])
    .map((suggestion) => ({ suggestion, item: itemById.get(suggestion.reviewQueueItemId) }))
    .filter(({ suggestion, item }) => item &&
      item.status === 'pending' &&
      suggestion.suggestionStatus !== 'suggestion_available');

  if (!items.length) {
    log('\nNenhum item pendente exigindo leitura/contexto nesta rodada.', 'green');
    return;
  }

  let markedContext = 0;
  let rejected = 0;
  let skipped = 0;

  console.log();
  log(`Itens que precisam de leitura/contexto: ${items.length}`, 'cyan');
  log('Eles nao tem sugestao segura para aprovacao rapida.', 'dim');

  for (let index = 0; index < items.length; index++) {
    const { suggestion, item } = items[index];
    console.log();
    log(`Item ${index + 1}/${items.length} · ID ${item.id}`, 'cyan');
    log(`${humanType(suggestion.type || item.type)} · ${suggestion.suggestionStatus || 'pendente'}`, 'yellow');
    console.log(`Arquivo: ${item.filePath || '-'} · ${item.nodeId || '-'}`);
    console.log();
    log('TRECHO', 'dim');
    console.log(normalizeText(suggestion.currentParagraph || item.currentParagraph || item.textPreview, 520));
    console.log();
    log('MOTIVO', 'dim');
    console.log(normalizeText(suggestion.reason || item.reason || item.notAppliedReason, 360));
    console.log();

    const answer = (await ask(color('O que fazer? (C=ver contexto / M=manter atual / P=pular / S=sair): ', 'yellow'))).trim().toLowerCase();
    const now = new Date().toISOString();

    if (answer === 's' || answer === 'sair') break;
    if (answer === 'c' || answer === 'contexto') {
      printIfPresent('PARAGRAFO ANTERIOR', suggestion.previousParagraph || item.previousParagraph);
      printIfPresent('PARAGRAFO ATUAL COMPLETO', suggestion.currentParagraph || item.currentParagraph, 1400);
      printIfPresent('PARAGRAFO POSTERIOR', suggestion.nextParagraph || item.nextParagraph);
      printIfPresent('ORIGINAL ALINHADO', suggestion.originalAlignedText || item.originalAlignedText, 1400);
      console.log();
      const afterContext = (await ask(color('Depois de ver o contexto: (M=manter atual / N=marcar precisa contexto futuro / P=pular / S=sair): ', 'yellow'))).trim().toLowerCase();
      if (afterContext === 's' || afterContext === 'sair') break;
      if (afterContext === 'n' || afterContext === 'contexto') {
        item.status = 'needs_context';
        item.review = {
          ...(item.review || {}),
          source: 'menu_review',
          suggestionId: suggestion.id || null,
          reviewedAt: now,
          notes: 'Marcado como precisa de contexto futuro pelo menu interativo EPUB.',
        };
        markedContext += 1;
        log('Marcado como precisa de contexto futuro.', 'yellow');
      } else if (afterContext === 'm' || afterContext === 'manter' || afterContext === 'r' || afterContext === 'rejeitar') {
        item.status = 'rejected';
        item.review = {
          ...(item.review || {}),
          source: 'menu_review',
          suggestionId: suggestion.id || null,
          reviewedAt: now,
          notes: 'Texto atual mantido pelo menu interativo EPUB apos leitura de contexto.',
        };
        rejected += 1;
        log('Texto atual mantido; item removido da fila pendente.', 'yellow');
      } else {
        skipped += 1;
        log('Item pulado.', 'dim');
      }
    } else if (answer === 'm' || answer === 'manter' || answer === 'r' || answer === 'rejeitar') {
      item.status = 'rejected';
      item.review = {
        ...(item.review || {}),
        source: 'menu_review',
        suggestionId: suggestion.id || null,
        reviewedAt: now,
        notes: 'Texto atual mantido pelo menu interativo EPUB.',
      };
      rejected += 1;
      log('Texto atual mantido; item removido da fila pendente.', 'yellow');
    } else {
      skipped += 1;
      log('Item pulado.', 'dim');
    }

    const remaining = items.length - index - 1;
    if (remaining > 0) {
      const next = (await ask(color(`Ver proximo item? Restam ${remaining}. (S/N): `, 'yellow'))).trim().toLowerCase();
      if (next !== 's' && next !== 'sim' && next !== 'y') break;
    }
  }

  refreshReviewQueueSummary(reviewQueue);
  writeJson(reviewQueuePath, reviewQueue);

  console.log();
  log(`Revisao de contexto: ${markedContext} precisam de contexto, ${rejected} mantidos, ${skipped} pulados.`, 'cyan');
  log(`Relatorio editorial: ${displayPath(readerReportPath)}`, 'cyan');
}

async function ensurePdfEpubComparisonState() {
  if (fs.existsSync(pdfEpubComparisonStatePath)) return readJson(pdfEpubComparisonStatePath);

  log('\nRelatorio PDF x EPUB ainda nao existe. Gerando agora...', 'yellow');
  await generatePdfEpubComparisonReportFromMenu({ warnOnly: false });
  return readJson(pdfEpubComparisonStatePath);
}

function printPdfEpubReviewItem(item, position, total) {
  console.log();
  log(`Achado PDF x EPUB ${position}/${total} · ${item.id}`, 'cyan');
  log(`${item.categoryLabel} · ${item.type} · Capitulo ${item.chapter}`, 'yellow');
  console.log();
  printKeyValueBox([
    { label: 'TERMO / LOCAL', value: item.problematicTerm || item.location },
    { label: 'ORIGINAL PDF', value: item.original },
    { label: 'TRADUCAO EPUB', value: item.translation },
    { label: 'PROBLEMA', value: item.problem },
    { label: 'RECOMENDACAO', value: item.recommendation },
    { label: 'FRASE OU LOCAL', value: item.location },
  ]);
  console.log();
}

function printPdfEpubDecisionOptions(options) {
  log('OPCOES', 'cyan');
  for (const option of options) {
    log(`  ${option.key}. ${option.label}`, 'white');
  }
  console.log();
}

async function readPdfEpubReviewDecision(item) {
  const options = decisionOptionsForItem(item);
  printPdfEpubDecisionOptions(options);

  const answer = (await ask(color('Escolha uma opcao: ', 'yellow'))).trim();
  const selected = options.find((option) => option.key.toLowerCase() === answer.toLowerCase());
  if (!selected) return { action: 'skip' };
  if (selected.action !== 'manual') return selected;

  const replacement = (await ask(color('Digite a substituicao desejada: ', 'yellow'))).trim();
  if (!replacement) return { action: 'skip' };
  return { action: 'apply', label: `Editar manualmente para "${replacement}"`, replacement };
}

function buildAndPersistPdfEpubReviewQueue() {
  const audit = readJson(pdfEpubComparisonStatePath);
  if (!audit) return null;

  const existingQueue = readJson(pdfEpubReviewQueuePath);
  const queue = buildPdfEpubReviewQueue({ audit, existingQueue });
  writeJson(pdfEpubReviewQueuePath, queue);
  return queue;
}

async function applyApprovedPdfEpubFindings() {
  const queue = readJson(pdfEpubReviewQueuePath);
  if (!queue) {
    log('\nFila PDF x EPUB ainda nao existe. Valide achados primeiro.', 'yellow');
    return;
  }

  const approvedItems = (queue.items || []).filter((item) => item.status === 'approved');
  const pendingApplicationItems = approvedItems.filter((item) => !item.application?.finalPath && !item.application?.appliedAt);
  if (!approvedItems.length) {
    log('\nNenhum achado PDF x EPUB aprovado para aplicar.', 'yellow');
    return;
  }

  console.log();
  log(`Achados PDF x EPUB aprovados: ${approvedItems.length}`, 'cyan');
  log(`Pendentes de aplicacao: ${pendingApplicationItems.length} · Ja aplicados: ${approvedItems.length - pendingApplicationItems.length}`, 'dim');

  if (!pendingApplicationItems.length) {
    log('\nTodos os achados PDF x EPUB aprovados ja foram aplicados anteriormente.', 'green');
    log(`Fila: ${displayPath(pdfEpubReviewQueuePath)}`, 'cyan');
    return;
  }

  console.log();
  log('Pendentes de aplicacao:', 'yellow');
  for (const item of pendingApplicationItems.slice(0, 10)) {
    console.log(`   ${item.id} · Capitulo ${item.chapter} · ${item.recommendation}`);
  }
  if (pendingApplicationItems.length > 10) console.log(`   ... e mais ${pendingApplicationItems.length - 10} achados`);

  console.log();
  const answer = (await ask(color(`Gerar nova versao do EPUB com ${pendingApplicationItems.length} achado(s) aprovado(s) pendente(s)? (S/N): `, 'yellow'))).trim().toLowerCase();
  if (answer !== 's' && answer !== 'sim' && answer !== 'y') {
    log('Aplicacao cancelada. Os achados continuam aprovados na fila separada.', 'dim');
    return;
  }

  try {
    const report = await applyApprovedPdfEpubFindingsToEpub();
    if (report.noOp) {
      log(report.message, 'green');
      return;
    }
    log(`Nova versao criada: ${report.version}`, 'green');
    log(`Substituicoes aplicadas: ${report.totalReplacements}`, 'green');
    log(`Arquivo final: ${displayPath(report.finalPath)}`, 'cyan');

    await generatePdfEpubComparisonReportFromMenu({ warnOnly: true });
  } catch (error) {
    log(`Aplicacao PDF x EPUB nao executada: ${error.message}`, 'yellow');
  }
}

async function offerApplyApprovedPdfEpubFindings(queue) {
  const approvedCount = (queue.items || []).filter((item) => item.status === 'approved').length;
  if (!approvedCount) return;

  const answer = (await ask(color(`Aplicar achados PDF x EPUB aprovados agora? (${approvedCount} aprovado(s)) (S/N): `, 'yellow'))).trim().toLowerCase();
  if (answer === 's' || answer === 'sim' || answer === 'y') {
    await applyApprovedPdfEpubFindings();
  }
}

async function importPdfEpubDecisionsFromReport() {
  const fallbackPath = findLatestDecisionExport(workflowRoot);
  const fallbackLabel = fallbackPath ? displayPath(fallbackPath) : 'nenhum encontrado';
  const answer = (await ask(color(`Caminho do JSON exportado pelo relatorio (Enter para ${fallbackLabel}): `, 'yellow'))).trim();
  const decisionsPath = answer ? path.resolve(answer) : fallbackPath;

  if (!decisionsPath || !fs.existsSync(decisionsPath)) {
    log('\nArquivo de decisoes nao encontrado.', 'red');
    return;
  }

  if (!fs.existsSync(pdfEpubReviewQueuePath)) buildAndPersistPdfEpubReviewQueue();

  try {
    const report = importPdfEpubDecisions({ decisionsPath, queuePath: pdfEpubReviewQueuePath });
    console.log();
    log(`Decisoes importadas: ${displayPath(report.decisionsPath)}`, 'green');
    log(`Aprovadas: ${report.summary.approved} · Mantidas: ${report.summary.kept} · Puladas: ${report.summary.skipped} · Nao encontradas: ${report.summary.missing}`, 'cyan');
    log(`Fila atualizada: ${displayPath(pdfEpubReviewQueuePath)}`, 'cyan');
  } catch (error) {
    log(`Falha ao importar decisoes: ${error.message}`, 'red');
  }
}

async function selectPdfEpubReviewCategory(queue) {
  const options = pendingCategoryOptions(queue);
  const total = options.reduce((sum, option) => sum + option.count, 0);
  if (!options.length) return { categoryId: null, label: 'Todos', total: 0 };

  console.log();
  log('VALIDAR ACHADOS PDF x EPUB', 'cyan');
  console.log();
  log(`  1. Todos os achados pendentes (${total})`, 'white');
  options.forEach((option, index) => {
    log(`  ${index + 2}. ${option.label} (${option.count})`, 'white');
  });
  log(`  ${options.length + 2}. Voltar`, 'white');
  console.log();

  const answer = (await ask(color(`Escolha uma opcao (1-${options.length + 2}): `, 'yellow'))).trim();
  const numeric = Number(answer);
  if (numeric === options.length + 2) return null;
  if (numeric === 1 || !Number.isInteger(numeric)) return { categoryId: null, label: 'Todos', total };

  const selected = options[numeric - 2];
  return selected ? { categoryId: selected.id, label: selected.label, total: selected.count } : { categoryId: null, label: 'Todos', total };
}

async function validatePdfEpubFindings() {
  const audit = await ensurePdfEpubComparisonState();
  if (!audit) {
    log('\nNao foi possivel carregar o relatorio PDF x EPUB.', 'red');
    return;
  }

  let queue = buildAndPersistPdfEpubReviewQueue();
  if (!queue || !queue.items?.length) {
    log('\nNenhum achado PDF x EPUB para validar.', 'green');
    return;
  }

  const selectedCategory = await selectPdfEpubReviewCategory(queue);
  if (!selectedCategory) return;

  const pendingItems = filterPendingItems(queue, selectedCategory.categoryId);
  if (!pendingItems.length) {
    log(`\nNenhum achado PDF x EPUB pendente em ${selectedCategory.label}.`, 'green');
    log(`Fila: ${displayPath(pdfEpubReviewQueuePath)}`, 'cyan');
    log(`Aprovados: ${queue.summary.approved} · Descartados: ${queue.summary.rejected}`, 'dim');
    return;
  }

  log(`\nCategoria selecionada: ${selectedCategory.label} (${pendingItems.length} pendente(s))`, 'cyan');

  let approved = 0;
  let discarded = 0;
  let skipped = 0;

  for (let index = 0; index < pendingItems.length; index++) {
    const item = pendingItems[index];
    printPdfEpubReviewItem(item, index + 1, pendingItems.length);

    const decision = await readPdfEpubReviewDecision(item);
    const now = new Date().toISOString();

    if (decision.action === 'back') return;
    if (decision.action === 'exit') break;
    if (decision.action === 'apply') {
      const replacement = replacementForDecision(item, decision.replacement);
      applyReviewDecision(item, { ...decision, replacement: decision.replacement }, now);
      approved += 1;
      log(replacement ? `Correcao aprovada: ${replacement.from} -> ${replacement.to}` : 'Achado aprovado para revisao posterior.', 'green');
    } else if (decision.action === 'keep') {
      applyReviewDecision(item, decision, now);
      discarded += 1;
      log('Texto mantido como esta.', 'yellow');
    } else {
      skipped += 1;
      log('Achado pulado.', 'dim');
    }

    refreshPdfEpubReviewQueueSummary(queue);
    writeJson(pdfEpubReviewQueuePath, queue);

    const remaining = pendingItems.length - index - 1;
    if (remaining > 0) {
      const next = (await ask(color(`Ver proximo achado? Restam ${remaining}. (S/N): `, 'yellow'))).trim().toLowerCase();
      if (next !== 's' && next !== 'sim' && next !== 'y') {
        await offerApplyApprovedPdfEpubFindings(queue);
        break;
      }
    }
  }

  refreshPdfEpubReviewQueueSummary(queue);
  writeJson(pdfEpubReviewQueuePath, queue);

  console.log();
  log(`Validacao PDF x EPUB: ${approved} aprovados, ${discarded} descartados, ${skipped} pulados.`, 'cyan');
  log(`Fila separada: ${displayPath(pdfEpubReviewQueuePath)}`, 'cyan');
}

async function reviewSuggestionsMenu() {
  while (true) {
    console.log();
    log('FLUXO DE REVISÃO', 'cyan');
    console.log();
    log('  1. Sugestões da auditoria EPUB', 'white');
    log('     Aprovar sugestão ou manter texto atual', 'dim');
    console.log();
    log('  2. Validar achados PDF x EPUB', 'white');
    log('     Aprovar achados editoriais para revisão/correção posterior', 'dim');
    console.log();
    log('  3. Importar decisões aprovadas', 'white');
    log('     Importar JSON exportado pelo relatorio PDF x EPUB', 'dim');
    console.log();
    log('  4. Aplicar correções aprovadas', 'white');
    log('     Gerar nova versao do EPUB a partir das correcoes aprovadas', 'dim');
    console.log();
    log('  5. Voltar', 'white');
    console.log();

    const choice = (await ask(color('Escolha uma opcao (1/2/3/4/5): ', 'yellow'))).trim();
    if (choice === '1') {
      await reviewReadySuggestions();
      return;
    }
    if (choice === '2') {
      await validatePdfEpubFindings();
      continue;
    }
    if (choice === '3') {
      await importPdfEpubDecisionsFromReport();
      continue;
    }
    if (choice === '4') {
      await applyApprovedPdfEpubFindings();
      return;
    }
    if (choice === '5') return;
    log('\nOpcao invalida.', 'red');
  }
}

function viewSummary() {
  if (!fs.existsSync(summaryPath)) {
    log(`\nResumo ainda nao existe: ${displayPath(summaryPath)}`, 'yellow');
    log('Rode a auditoria primeiro.', 'dim');
    return;
  }

  const lines = fs.readFileSync(summaryPath, 'utf8').split(/\r?\n/);
  console.log('\n' + lines.slice(0, 160).join('\n'));
  if (lines.length > 160) {
    log(`\n... resumo truncado no menu. Arquivo completo: ${displayPath(summaryPath)}`, 'dim');
  }
}

function viewJsonPath() {
  const latestReportPath = findLatestJsonReport();
  if (!latestReportPath || !fs.existsSync(latestReportPath)) {
    log(`\nJSON ainda nao existe: ${displayPath(reportPattern)}`, 'yellow');
    log('Rode a auditoria primeiro.', 'dim');
    return;
  }

  log(`\nJSON completo: ${displayPath(latestReportPath)}`, 'cyan');
}

function findLatestJsonReport() {
  if (!fs.existsSync(reportsJsonDir)) return null;
  const reports = fs.readdirSync(reportsJsonDir)
    .filter((file) => /^audit-report-.*\.json$/i.test(file))
    .map((file) => path.join(reportsJsonDir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return reports[0] || null;
}

function viewHtmlPath() {
  viewReaderReportPath();
}

function viewValidationPath() {
  viewReaderReportPath();
}

function viewReaderReportPath() {
  if (!fs.existsSync(readerReportPath)) {
    log(`\nRelatorio editorial ainda nao existe: ${displayPath(readerReportPath)}`, 'yellow');
    log('Rode a auditoria primeiro.', 'dim');
    return;
  }

  log(`\nRelatorio editorial: ${displayPath(readerReportPath)}`, 'cyan');
}

async function cleanOldReports() {
  if (!fs.existsSync(reportsDir) && !fs.existsSync(logsDir)) {
    log('\nNenhum diretorio de relatorios/logs encontrado.', 'yellow');
    return;
  }

  const buckets = [
    { dir: logsDir, type: '.' },
    { dir: reportsTxtDir, type: 'reports/txt' },
    { dir: reportsJsonDir, type: 'reports/json' },
    { dir: reportsHtmlDir, type: 'reports/html' },
  ];
  const files = buckets.flatMap((bucket) => {
    if (!fs.existsSync(bucket.dir)) return [];
    return fs.readdirSync(bucket.dir)
      .filter((file) => !fs.statSync(path.join(bucket.dir, file)).isDirectory())
      .filter((file) => {
        if (bucket.type !== '.' && (file === '.gitkeep' || file === '.DS_Store')) return true;
        return /^(audit-report|epub-audit-|fix-report|epub-fix-|audit-dashboard|validation-report|reader-report|workflow-events|assisted-review-model-trace|review-queue|assisted-review-suggestions|correction-report).*\.(json|jsonl|txt|md|html)$/i.test(file);
      })
      .map((file) => ({ file, path: path.join(bucket.dir, file), type: bucket.type }));
  });

  if (!files.length) {
    log('\nNenhum relatorio antigo para limpar.', 'yellow');
    return;
  }

  console.log();
  log(`📊 Encontrados ${files.length} relatorios/logs gerados`, 'cyan');
  console.log();

  for (const item of files.slice(0, 10)) {
    const stats = fs.statSync(item.path);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`   📄 ${item.type === '.' ? `logs/${item.file}` : `${item.type}/${item.file}`} (${size} KB)`);
  }
  if (files.length > 10) {
    console.log(`   ... e mais ${files.length - 10} arquivos`);
  }

  console.log();
  log('❓ O que deseja fazer?', 'yellow');
  console.log();
  log('  1. 🗑️  Limpar TODOS os relatorios', 'red');
  log('  2. 📌 Manter apenas o padrao atual', 'cyan');
  log('  3. ❌ Cancelar', 'white');
  console.log();

  const option = (await ask(color('Escolha uma opcao (1/2/3): ', 'yellow'))).trim().toLowerCase();

  if (option === '3') {
    log('Limpeza cancelada.', 'dim');
    return;
  }

  let toDelete = [];

  if (option === '1') {
    toDelete = files;
    log(`\nATENCAO: todos os ${toDelete.length} relatorios gerados serao removidos.`, 'red');
  } else if (option === '2') {
    const newestAuditReport = findLatestJsonReport();
    const currentPaths = new Set([
      summaryPath,
      readerReportPath,
      path.join(logsDir, 'workflow-events.jsonl'),
    ]);
    toDelete = files.filter((item) => {
      if (newestAuditReport && item.path === newestAuditReport) return false;
      return !currentPaths.has(item.path);
    });

    if (!toDelete.length) {
      log('\nNenhum historico para remover. Restaram apenas os arquivos do padrao atual.', 'green');
      return;
    }
  } else {
    log('\nOpcao invalida. Limpeza cancelada.', 'red');
    return;
  }

  const answer = (await ask(color('Tem certeza? (S/N): ', 'red'))).trim().toLowerCase();
  if (answer !== 's' && answer !== 'sim' && answer !== 'y') {
    log('Limpeza cancelada.', 'dim');
    return;
  }

  for (const item of toDelete) {
    fs.unlinkSync(item.path);
  }

  removeEmptyReportDirs();

  log(`Relatorios removidos: ${toDelete.length}`, 'green');
}

function removeEmptyReportDirs() {
  for (const dir of [reportsTxtDir, reportsJsonDir, reportsHtmlDir]) {
    if (!fs.existsSync(dir)) continue;

    const remaining = fs.readdirSync(dir).filter((file) => file !== '.DS_Store');
    if (remaining.length === 0) {
      const dsStore = path.join(dir, '.DS_Store');
      if (fs.existsSync(dsStore)) fs.unlinkSync(dsStore);
      fs.rmdirSync(dir);
    }
  }
}

function listFilesRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) return [targetPath];

  return fs.readdirSync(targetPath).flatMap((entry) => {
    const entryPath = path.join(targetPath, entry);
    if (entry === '.gitkeep' || entry === '.DS_Store') return [];
    return listFilesRecursive(entryPath);
  });
}

function removeGeneratedPath(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function ensureKeepFile(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  const keepPath = path.join(dirPath, '.gitkeep');
  if (!fs.existsSync(keepPath)) fs.writeFileSync(keepPath, '', 'utf8');
}

function generatedStateFilesForRecentAudit() {
  return [
    'editorial-findings.json',
    'semantic-candidates.json',
    'assisted-review-suggestions.json',
    'post-correction-validation.json',
    'reaudit-report.json',
    'reauditoria-summary.json',
    'pdf-epub-comparison.json',
    'pdf-epub-review-queue.json',
  ].map((file) => path.join(stateDir, file));
}

function generatedStateFilesForNewWork() {
  return [
    'correction-plan.json',
    'correction-report.json',
    'editorial-findings.json',
    'review-queue.json',
    'semantic-candidates.json',
    'assisted-review-suggestions.json',
    'post-correction-validation.json',
    'reaudit-report.json',
    'reauditoria-summary.json',
    'pdf-epub-comparison.json',
    'pdf-epub-review-queue.json',
  ].map((file) => path.join(stateDir, file));
}

function printCleanupPreview(title, pathsToRemove) {
  const files = pathsToRemove.flatMap(listFilesRecursive);
  console.log();
  log(title, 'cyan');
  log(`Arquivos encontrados: ${files.length}`, files.length ? 'yellow' : 'dim');
  for (const file of files.slice(0, 12)) {
    console.log(`   ${displayPath(file)}`);
  }
  if (files.length > 12) console.log(`   ... e mais ${files.length - 12} arquivos`);
  return files.length;
}

async function confirmTypedCleanup(expectedText) {
  console.log();
  const answer = (await ask(color(`Digite ${expectedText} para confirmar: `, 'red'))).trim();
  return answer === expectedText;
}

async function confirmYesNo(message = 'Tem certeza?') {
  console.log();
  const answer = (await ask(color(`${message} (S/N): `, 'red'))).trim().toLowerCase();
  return answer === 's' || answer === 'sim' || answer === 'y' || answer === 'yes';
}

async function cleanRecentAudit() {
  const pathsToRemove = [
    reportsDir,
    logsDir,
    ...generatedStateFilesForRecentAudit(),
  ];
  const count = printCleanupPreview('Limpar auditoria recente', pathsToRemove);
  if (!count) {
    log('\nNada para limpar nesta auditoria recente.', 'yellow');
    return;
  }

  log('\nEsta acao preserva input-fixed, output, correction-plan e review-queue.', 'dim');
  if (!(await confirmYesNo('Limpar auditoria recente?'))) {
    log('Limpeza cancelada.', 'dim');
    return;
  }

  let removed = 0;
  for (const targetPath of pathsToRemove) {
    if (removeGeneratedPath(targetPath)) removed += 1;
  }
  ensureKeepFile(reportsDir);
  ensureKeepFile(logsDir);
  ensureKeepFile(reportsTxtDir);
  ensureKeepFile(reportsJsonDir);
  ensureKeepFile(reportsHtmlDir);

  log(`Itens removidos: ${removed}`, 'green');
}

async function cleanAllForNewWork() {
  const pathsToRemove = [
    reportsDir,
    logsDir,
    path.join(inputFixedDir, 'manifest.json'),
    ...(fs.existsSync(inputFixedDir)
      ? fs.readdirSync(inputFixedDir)
        .filter((entry) => /^v\d+$/i.test(entry))
        .map((entry) => path.join(inputFixedDir, entry))
      : []),
    ...(fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir)
        .filter((entry) => entry.toLowerCase().endsWith('.epub'))
        .map((entry) => path.join(outputDir, entry))
      : []),
    ...generatedStateFilesForNewWork(),
  ];
  const count = printCleanupPreview('Limpar Tudo - Iniciar nova Obra', pathsToRemove);
  if (!count) {
    log('\nNada para limpar para iniciar nova obra.', 'yellow');
    return;
  }

  log('\nEsta acao preserva input/source, input/translated, input/glossary e input/translation-log.', 'yellow');
  if (!(await confirmTypedCleanup('NOVA OBRA'))) {
    log('Limpeza cancelada.', 'dim');
    return;
  }

  let removed = 0;
  for (const targetPath of pathsToRemove) {
    if (removeGeneratedPath(targetPath)) removed += 1;
  }
  ensureKeepFile(reportsDir);
  ensureKeepFile(logsDir);
  ensureKeepFile(inputFixedDir);
  ensureKeepFile(outputDir);
  ensureKeepFile(stateDir);

  log(`Itens removidos: ${removed}`, 'green');
}

async function pause() {
  await ask(color('\nPressione Enter para continuar...', 'dim'));
}

async function runAuditWithLanguageSelection(verbose = false) {
  console.log();
  log('1/2 Selecionar idioma de origem', 'cyan');
  const sourceLanguage = await selectSourceLanguage();

  console.log();
  log('2/2 Auditoria da traducao atual', 'cyan');
  runAudit({ verbose, sourceLanguage });
}

async function main() {
  while (true) {
    printHeader();
    const choice = (await ask(color('Digite sua opcao: ', 'yellow'))).trim();

    if (choice === '1') {
      await runRevisionWorkflow();
      await pause();
    } else if (choice === '2') {
      runPdfEpubComparisonReport();
      await pause();
    } else if (choice === '3') {
      exportPdfEpubFullFindings();
      await pause();
    } else if (choice === '4') {
      await cleanOldReports();
      await pause();
    } else if (choice === '5') {
      await reviewSuggestionsMenu();
      await pause();
    } else if (choice === '6') {
      await viewContextItems();
      await pause();
    } else if (choice === '7') {
      await cleanRecentAudit();
      await pause();
    } else if (choice === '8') {
      await cleanAllForNewWork();
      await pause();
    } else if (choice === '9') {
      await runAuditWithLanguageSelection(false);
      await pause();
    } else if (choice === '10') {
      await runAuditWithLanguageSelection(true);
      await pause();
    } else if (choice === '11') {
      rl.close();
      return;
    } else {
      log('\nOpcao invalida.', 'red');
      await pause();
    }
  }
}

main().catch((error) => {
  rl.close();
  console.error(`Erro fatal: ${error.message}`);
  process.exit(1);
});
