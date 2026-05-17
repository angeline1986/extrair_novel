#!/usr/bin/env node
// src/run-full-audit.js
// Workflow completo: Auditar → Corrigir → Re-auditar

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runScript(scriptPath, args = []) {
  try {
    const cmd = `node ${scriptPath} ${args.join(' ')}`;
    log(`\n▶ Executando: ${cmd}`, 'cyan');
    execSync(cmd, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    log(`❌ Erro ao executar: ${scriptPath}`, 'red');
    return false;
  }
}

function backupOriginalFiles() {
  const translatedDir = path.join(projectRoot, 'input', 'translated');
  const backupDir = path.join(projectRoot, 'input', 'backup');
  
  if (!fs.existsSync(translatedDir)) {
    log(`⚠️ Pasta input/translated não encontrada`, 'yellow');
    return false;
  }
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const files = fs.readdirSync(translatedDir).filter(f => f.endsWith('.docx'));
  
  if (files.length === 0) {
    log(`⚠️ Nenhum arquivo .docx encontrado em input/translated`, 'yellow');
    return false;
  }
  
  for (const file of files) {
    const src = path.join(translatedDir, file);
    const dest = path.join(backupDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      log(`  📋 Backup: ${file}`, 'green');
    }
  }
  
  return true;
}

function restoreFromBackup() {
  const translatedDir = path.join(projectRoot, 'input', 'translated');
  const backupDir = path.join(projectRoot, 'input', 'backup');
  
  if (!fs.existsSync(backupDir)) return;
  
  const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.docx'));
  
  for (const backup of backups) {
    const src = path.join(backupDir, backup);
    const dest = path.join(translatedDir, backup);
    fs.copyFileSync(src, dest);
    log(`  📋 Restaurado: ${backup}`, 'green');
  }
}

function applyFixedFiles() {
  const fixedDir = path.join(projectRoot, 'output', 'fixed');
  const translatedDir = path.join(projectRoot, 'input', 'translated');
  
  if (!fs.existsSync(fixedDir)) return false;
  
  const fixedFiles = fs.readdirSync(fixedDir).filter(f => f.endsWith('_fixed.docx'));
  
  for (const fixedFile of fixedFiles) {
    const originalName = fixedFile.replace('_fixed.docx', '.docx');
    const src = path.join(fixedDir, fixedFile);
    const dest = path.join(translatedDir, originalName);
    
    // Backup do original já foi feito
    fs.copyFileSync(src, dest);
    log(`  ✅ Aplicado: ${originalName} (corrigido)`, 'green');
  }
  
  return true;
}

function showSummary(auditResult) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 RESUMO DO WORKFLOW', 'bold');
  log('='.repeat(60), 'cyan');
  
  if (auditResult) {
    // Tentar ler o último relatório
    const outputDir = path.join(projectRoot, 'output');
    const files = fs.readdirSync(outputDir).filter(f => f.startsWith('audit-report-') && f.endsWith('.json'));
    
    if (files.length > 0) {
      const latest = files.sort().reverse()[0];
      const reportPath = path.join(outputDir, latest);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      
      log(`\n📈 RESULTADO DA AUDITORIA FINAL:`, 'bold');
      log(`   Status: ${report.status === 'OK' ? '✅ OK' : report.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL'}`, 
          report.status === 'OK' ? 'green' : report.status === 'WARN' ? 'yellow' : 'red');
      log(`   Issues FAIL: ${report.stats.failIssues}`);
      log(`   Issues WARN: ${report.stats.warnIssues}`);
      log(`   Total correções aplicadas: ${report.stats.failIssues + report.stats.warnIssues}`);
    }
  }
  
  log('\n📁 ARQUIVOS GERADOS:', 'bold');
  log(`   Relatórios: workflows/audit-translation-docx/output/`);
  log(`   Arquivos corrigidos: workflows/audit-translation-docx/output/fixed/`);
  log(`   Backups: workflows/audit-translation-docx/input/backup/`);
}

function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🚀 WORKFLOW COMPLETO DE AUDITORIA E CORREÇÃO', 'bold');
  log('='.repeat(60), 'cyan');
  
  // Passo 1: Backup dos arquivos originais
  log('\n📦 PASSO 1: Backup dos arquivos originais', 'bold');
  if (!backupOriginalFiles()) {
    log('⚠️ Nenhum arquivo para processar. Encerrando.', 'yellow');
    return;
  }
  
  // Passo 2: Auditoria inicial
  log('\n🔍 PASSO 2: Auditoria inicial', 'bold');
  const auditScript = path.join(projectRoot, 'src', 'index.js');
  const auditSuccess = runScript(auditScript, ['--verbose']);
  
  if (!auditSuccess) {
    log('❌ Auditoria inicial falhou. Verifique os arquivos.', 'red');
    return;
  }
  
  // Perguntar se quer corrigir
  log('\n❓ Deseja aplicar correções automáticas de gênero? (s/N)', 'yellow');
  
  // Para execução automática (sem interação), usar flag --auto
  const isAuto = process.argv.includes('--auto');
  
  if (!isAuto) {
    log('⚠️ Execute com --auto para aplicar correções automaticamente', 'cyan');
    log('   Ex: node src/run-full-audit.js --auto', 'cyan');
    log('\n✨ Workflow concluído (sem correções automáticas)', 'green');
    return;
  }
  
  // Passo 3: Corrigir problemas de gênero
  log('\n🔧 PASSO 3: Corrigindo problemas de gênero', 'bold');
  const fixScript = path.join(projectRoot, 'src', 'fix-gender-issues.js');
  const fixSuccess = runScript(fixScript, ['--verbose']);
  
  if (!fixSuccess) {
    log('⚠️ Correção falhou parcialmente', 'yellow');
  }
  
  // Passo 4: Aplicar arquivos corrigidos
  log('\n📋 PASSO 4: Aplicando correções', 'bold');
  applyFixedFiles();
  
  // Passo 5: Re-auditar com os arquivos corrigidos
  log('\n🔄 PASSO 5: Re-auditando após correções', 'bold');
  const reauditSuccess = runScript(auditScript, ['--verbose']);
  
  // Passo 6: Mostrar resumo
  showSummary(reauditSuccess);
  
  log('\n✨ WORKFLOW CONCLUÍDO!', 'green');
  log('   Arquivos originais mantidos em input/backup/', 'cyan');
  log('   Arquivos corrigidos em output/fixed/', 'cyan');
  log('   Para usar os corrigidos, mova de output/fixed/ para input/translated/', 'cyan');
}

// Executar
main();