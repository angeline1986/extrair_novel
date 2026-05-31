#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { fixEpub } from './fixEpub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(workflowRoot, '../..');
const logsDir = path.join(workflowRoot, 'logs');
const stateDir = path.join(workflowRoot, 'state');
const reportsDir = path.join(workflowRoot, 'reports');
const reportsTxtDir = path.join(reportsDir, 'txt');
const reportsJsonDir = path.join(reportsDir, 'json');
const reportsHtmlDir = path.join(reportsDir, 'html');
const summaryPath = path.join(reportsTxtDir, 'epub-audit-summary-latest.txt');
const reportPattern = path.join(reportsJsonDir, 'audit-report-*.json');
const htmlPath = path.join(reportsHtmlDir, 'audit-dashboard-latest.html');
const validationPath = path.join(reportsHtmlDir, 'validation-report-latest.html');
const readerReportPath = path.join(reportsHtmlDir, 'reader-report-latest.html');
const reviewQueuePath = path.join(stateDir, 'review-queue.json');
const assistedReviewPath = path.join(stateDir, 'assisted-review-suggestions.json');

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
  log('║  Relatorios: TXT, JSON e HTML                                  ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();

  log('📋 ESCOLHA UMA OPCAO:', 'yellow');
  console.log();

  log('  ┌───────────── FLUXO PRINCIPAL ─────────────┐', 'dim');
  log('  1. 🚀 Gerar versao revisada da traducao', 'green');
  log('     Audita + aplica correcoes seguras + valida + reaudita', 'dim');
  console.log();

  log('  ┌───────────── REVISAO ───────────────┐', 'dim');
  log('  2. ✅ Revisar sugestoes prontas', 'cyan');
  log('     Aprovar sugestao ou manter texto atual', 'dim');
  log('  3. 👀 Ver itens que precisam de leitura/contexto', 'cyan');
  log('     Mostra pendencias sem sugestao segura', 'dim');
  console.log();

  log('  ┌───────────── AUDITORIA ─────────────┐', 'dim');
  log('  4. 🔍 Auditar traducao atual', 'white');
  log('  5. 🔍📋 Auditar traducao atual com detalhes', 'white');
  console.log();

  log('  ┌───────────── RELATORIOS ────────────┐', 'dim');
  log('  6. 🗑️  Limpar relatorios antigos', 'red');
  console.log();

  log('  ┌───────────── SISTEMA ───────────────┐', 'dim');
  log('  7. ❌ Sair', 'magenta');
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
  log('1/3 Selecionar idioma de origem', 'cyan');
  const sourceLanguage = await selectSourceLanguage();

  console.log();
  log('2/3 Auditoria da traducao atual', 'cyan');
  runAudit({ sourceLanguage });

  console.log();
  log('3/3 Gerando EPUB revisado, validando e reauditando', 'cyan');
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
    console.log();
    log(`Sugestao ${item.id}`, 'cyan');
    log(humanType(suggestion.type || item.type), 'yellow');
    console.log(`Arquivo: ${item.filePath || '-'} · ${item.nodeId || '-'}`);
    console.log();
    log('TRECHO ATUAL', 'dim');
    console.log(normalizeText(suggestion.currentParagraph || item.currentParagraph || item.textPreview));
    console.log();
    log('ANTES', 'dim');
    console.log(normalizeText(suggestion.before || suggestion.targetBefore || item.before));
    console.log();
    log('SUGESTAO', 'green');
    console.log(normalizeText(suggestion.suggestedAfter || suggestion.replacementAfter));
    console.log();

    const answer = (await ask(color('Aprovar sugestao? (A=aprovar / M=manter atual / P=pular): ', 'yellow'))).trim().toLowerCase();
    const now = new Date().toISOString();

    if (answer === 'a' || answer === 'aprovar') {
      item.status = 'approved';
      item.before = suggestion.before || suggestion.targetBefore || item.before;
      item.after = suggestion.suggestedAfter || suggestion.replacementAfter;
      item.review = {
        ...(item.review || {}),
        source: 'menu_review',
        suggestionId: suggestion.id || null,
        approvedAt: now,
        reviewedAt: now,
        notes: 'Aprovado pelo menu interativo EPUB.',
      };
      approved += 1;
      log('Sugestao aprovada.', 'green');
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
      log('Texto atual mantido; sugestao rejeitada.', 'yellow');
    } else {
      skipped += 1;
      log('Sugestao pulada.', 'dim');
    }
  }

  refreshReviewQueueSummary(reviewQueue);
  writeJson(reviewQueuePath, reviewQueue);

  console.log();
  log(`Revisao concluida: ${approved} aprovadas, ${rejected} mantidas, ${skipped} puladas.`, 'cyan');

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
  if (!fs.existsSync(htmlPath)) {
    log(`\nHTML ainda nao existe: ${displayPath(htmlPath)}`, 'yellow');
    log('Rode a auditoria primeiro.', 'dim');
    return;
  }

  log(`\nHTML: ${displayPath(htmlPath)}`, 'cyan');
}

function viewValidationPath() {
  if (!fs.existsSync(validationPath)) {
    log(`\nRelatorio de validacao ainda nao existe: ${displayPath(validationPath)}`, 'yellow');
    log('Rode a auditoria primeiro.', 'dim');
    return;
  }

  log(`\nValidacao: ${displayPath(validationPath)}`, 'cyan');
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
      htmlPath,
      validationPath,
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
      await reviewReadySuggestions();
      await pause();
    } else if (choice === '3') {
      await viewContextItems();
      await pause();
    } else if (choice === '4') {
      await runAuditWithLanguageSelection(false);
      await pause();
    } else if (choice === '5') {
      await runAuditWithLanguageSelection(true);
      await pause();
    } else if (choice === '6') {
      await cleanOldReports();
      await pause();
    } else if (choice === '7') {
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
