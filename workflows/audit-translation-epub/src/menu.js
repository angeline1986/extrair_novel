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
const logsTxtDir = path.join(logsDir, 'txt');
const logsJsonDir = path.join(logsDir, 'json');
const logsHtmlDir = path.join(logsDir, 'html');
const summaryPath = path.join(logsTxtDir, 'epub-audit-summary-latest.txt');
const reportPattern = path.join(logsJsonDir, 'audit-report-*.json');
const htmlPath = path.join(logsHtmlDir, 'audit-dashboard-latest.html');
const validationPath = path.join(logsHtmlDir, 'validation-report-latest.html');

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

function printHeader() {
  console.clear();
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                  AUDITORIA DE TRADUCAO EPUB                   ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Compara EPUB ingles + portugues e usa Log_Traducao.txt       ║', 'cyan');
  log('║  como insumo para validar termos, trocas e pendencias.         ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Relatorios: TXT, JSON e HTML                                  ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();

  log('📋 ESCOLHA UMA OPCAO:', 'yellow');
  console.log();

  log('  ┌───────────── FLUXO PRINCIPAL ─────────────┐', 'dim');
  log('  1. 🚀 Gerar versao revisada da traducao', 'green');
  log('     Audita + aplica trocas seguras do log + publica em output + reaudita', 'dim');
  console.log();

  log('  ┌───────────── AUDITORIA ─────────────┐', 'dim');
  log('  2. 🔍 Auditar traducao atual', 'white');
  log('  3. 🔍📋 Auditar traducao atual com detalhes', 'white');
  console.log();

  log('  ┌───────────── RELATORIOS ────────────┐', 'dim');
  log('  4. 📄 Ver ultimo resumo TXT', 'cyan');
  log('  5. 🧾 Ver caminho do JSON completo', 'cyan');
  log('  6. 🌐 Ver caminho do dashboard HTML', 'cyan');
  log('  7. 🧪 Ver caminho do relatorio de validacao', 'cyan');
  log('  8. 🗑️  Limpar relatorios antigos', 'red');
  console.log();

  log('  ┌───────────── SISTEMA ───────────────┐', 'dim');
  log('  9. ❌ Sair', 'magenta');
  console.log();
  console.log('─'.repeat(64));
  console.log();
}

function runAudit({ verbose = false } = {}) {
  const args = ['workflows/audit-translation-epub/src/audit.js'];
  if (verbose) args.push('--verbose');

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

async function runRevisionWorkflow() {
  console.log();
  log('1/3 Auditoria da traducao atual', 'cyan');
  runAudit();

  console.log();
  log('2/3 Gerando EPUB revisado com correcoes seguras', 'cyan');
  const report = await fixEpub();
  log(`Versao criada: ${report.version}`, 'green');
  log(`Substituicoes aplicadas: ${report.totalReplacements}`, 'green');
  log(
    `Pacote EPUB: mimetype primeiro=${report.packageValidation.mimetypeFirst ? 'sim' : 'nao'}, container=${report.packageValidation.hasContainer ? 'ok' : 'ausente'}`,
    report.packageValidation.mimetypeFirst && report.packageValidation.hasContainer ? 'green' : 'yellow'
  );
  log(`Arquivo final: ${displayPath(report.finalPath)}`, 'cyan');

  console.log();
  log('3/3 Reauditoria da versao revisada', 'cyan');
  runAuditForFile(report.finalPath);
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
  if (!fs.existsSync(logsJsonDir)) return null;
  const reports = fs.readdirSync(logsJsonDir)
    .filter((file) => /^audit-report-.*\.json$/i.test(file))
    .map((file) => path.join(logsJsonDir, file))
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

async function cleanOldReports() {
  if (!fs.existsSync(logsDir)) {
    log('\nNenhum diretorio de logs encontrado.', 'yellow');
    return;
  }

  const buckets = [
    { dir: logsDir, type: '.' },
    { dir: logsTxtDir, type: 'txt' },
    { dir: logsJsonDir, type: 'json' },
    { dir: logsHtmlDir, type: 'html' },
  ];
  const files = buckets.flatMap((bucket) => {
    if (!fs.existsSync(bucket.dir)) return [];
    return fs.readdirSync(bucket.dir)
      .filter((file) => !fs.statSync(path.join(bucket.dir, file)).isDirectory())
      .filter((file) => {
        if (bucket.type !== '.' && (file === '.gitkeep' || file === '.DS_Store')) return true;
        return /^(audit-report|epub-audit-|fix-report|epub-fix-|audit-dashboard|validation-report|workflow-events).*\.(json|jsonl|txt|html)$/i.test(file);
      })
      .map((file) => ({ file, path: path.join(bucket.dir, file), type: bucket.type }));
  });

  if (!files.length) {
    log('\nNenhum relatorio antigo para limpar.', 'yellow');
    return;
  }

  console.log();
  log(`📊 Encontrados ${files.length} relatorios na pasta logs/`, 'cyan');
  console.log();

  for (const item of files.slice(0, 10)) {
    const stats = fs.statSync(item.path);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`   📄 ${item.type === '.' ? item.file : `${item.type}/${item.file}`} (${size} KB)`);
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

  const answer = (await ask(color('Tem certeza? (s/N): ', 'red'))).trim().toLowerCase();
  if (answer !== 's' && answer !== 'sim' && answer !== 'y') {
    log('Limpeza cancelada.', 'dim');
    return;
  }

  for (const item of toDelete) {
    fs.unlinkSync(item.path);
  }

  removeEmptyLegacyLogDirs();

  log(`Relatorios removidos: ${toDelete.length}`, 'green');
}

function removeEmptyLegacyLogDirs() {
  for (const dir of [logsTxtDir, logsJsonDir, logsHtmlDir]) {
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

async function main() {
  while (true) {
    printHeader();
    const choice = (await ask(color('Digite sua opcao: ', 'yellow'))).trim();

    if (choice === '1') {
      await runRevisionWorkflow();
      await pause();
    } else if (choice === '2') {
      runAudit();
      await pause();
    } else if (choice === '3') {
      runAudit({ verbose: true });
      await pause();
    } else if (choice === '4') {
      viewSummary();
      await pause();
    } else if (choice === '5') {
      viewJsonPath();
      await pause();
    } else if (choice === '6') {
      viewHtmlPath();
      await pause();
    } else if (choice === '7') {
      viewValidationPath();
      await pause();
    } else if (choice === '8') {
      await cleanOldReports();
      await pause();
    } else if (choice === '9') {
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
