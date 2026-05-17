#!/usr/bin/env node
// src/menu.js
// Menu interativo para auditoria e correção de traduções

import readline from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function clearScreen() {
  console.clear();
}

function showHeader() {
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                AUDITORIA DE TRADUÇÕES - GOOGLE TRADUTOR        ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Audita e corrige problemas comuns de gênero em traduções      ║', 'cyan');
  log('║  automáticas do Google Tradutor.                               ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();
}

function showMenu() {
  log('📋 ESCOLHA UMA OPÇÃO:', 'yellow');
  console.log();
  log('  1. 🔍 Auditoria normal', 'white');
  log('  2. 🔍📋 Auditoria com detalhes (verbose)', 'white');
  log('  3. 🔧 Corrigir problemas de gênero', 'white');
  log('  4. 🔧📋 Corrigir problemas de gênero (verbose)', 'white');
  log('  5. 🚀 Workflow completo (auditar + corrigir)', 'green');
  log('  6. 📊 Ver último relatório', 'cyan');
  log('  7. 🗑️  Limpar relatórios antigos', 'red');
  log('  8. ❌ Sair', 'magenta');
  console.log();
  console.log('─'.repeat(64));
  console.log();
}

function runCommand(command, description) {
  log(`\n▶ ${description}`, 'cyan');
  console.log('─'.repeat(64));
  
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: 'true' }
    });
    return true;
  } catch (error) {
    if (command.includes('audit')) {
      log(`\n⚠️ Auditoria concluída (problemas detectados são normais)`, 'yellow');
      return true;
    }
    log(`\n❌ Comando falhou: ${description}`, 'red');
    return false;
  }
}

function showLastReport() {
  const logsDir = path.join(projectRoot, 'workflows/audit-translation-docx/logs');
  
  if (!fs.existsSync(logsDir)) {
    log('⚠️ Nenhum relatório encontrado.', 'yellow');
    return;
  }
  
  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('audit-summary-') && f.endsWith('.txt'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    log('⚠️ Nenhum relatório encontrado.', 'yellow');
    return;
  }
  
  const latest = files[0];
  const reportPath = path.join(logsDir, latest);
  const content = fs.readFileSync(reportPath, 'utf8');
  
  log(`\n📄 Último relatório: ${latest}`, 'cyan');
  console.log('─'.repeat(64));
  console.log(content);
}

 async function cleanOldReports() {
  const logsDir = path.join(projectRoot, 'workflows/audit-translation-docx/logs');
  
  if (!fs.existsSync(logsDir)) {
    log('⚠️ Pasta de logs não encontrada.', 'yellow');
    return;
  }
  
  const files = fs.readdirSync(logsDir);
  
  // Filtrar todos os arquivos de relatório
  const reportFiles = files.filter(f => {
    return f.match(/\.(json|csv|txt)$/);
  });
  
  if (reportFiles.length === 0) {
    log('ℹ️ Nenhum relatório encontrado para limpar.', 'yellow');
    return;
  }
  
  console.log();
  log(`📊 Encontrados ${reportFiles.length} relatórios na pasta logs/`, 'cyan');
  console.log();
  
  // Mostrar todos os arquivos
  for (const file of reportFiles) {
    const stats = fs.statSync(path.join(logsDir, file));
    const size = (stats.size / 1024).toFixed(1);
    console.log(`   📄 ${file} (${size} KB)`);
  }
  
  console.log();
  log('❓ O que deseja fazer?', 'yellow');
  console.log();
  log('  1. 🗑️  Limpar TODOS os relatórios', 'red');
  log('  2. 📌 Manter apenas os 5 mais recentes', 'cyan');
  log('  3. ❌ Cancelar', 'white');
  console.log();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const option = await new Promise((resolve) => {
    rl.question('👉 Escolha uma opção (1/2/3): ', (resp) => {
      rl.close();
      resolve(resp.trim());
    });
  });
  
  if (option === '3') {
    log('✨ Operação cancelada.', 'yellow');
    return;
  }
  
  let toDelete = [];
  
  if (option === '1') {
    // Limpar TODOS
    toDelete = reportFiles;
    log(`\n⚠️ ATENÇÃO: Você está prestes a remover TODOS os ${toDelete.length} relatórios!`, 'red');
  } else if (option === '2') {
    // Manter apenas os 5 mais recentes
    const sortedFiles = [...reportFiles].sort((a, b) => {
      const statA = fs.statSync(path.join(logsDir, a));
      const statB = fs.statSync(path.join(logsDir, b));
      return statB.mtimeMs - statA.mtimeMs;
    });
    toDelete = sortedFiles.slice(5);
    
    if (toDelete.length === 0) {
      log(`\n✅ Nenhum relatório para remover. Já mantém apenas os 5 mais recentes.`, 'green');
      return;
    }
    
    console.log();
    log(`🗑️ Os seguintes ${toDelete.length} arquivo(s) antigos serão removidos:`, 'yellow');
    for (const file of toDelete) {
      console.log(`   - ${file}`);
    }
  } else {
    log('\n❌ Opção inválida. Operação cancelada.', 'red');
    return;
  }
  
  console.log();
  const confirm = await new Promise((resolve) => {
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl2.question('Tem certeza? (S/N): ', (resp) => {
      rl2.close();
      resolve(resp.toLowerCase());
    });
  });
  
  if (confirm !== 's' && confirm !== 'sim' && confirm !== 'y') {
    log('✨ Operação cancelada.', 'yellow');
    return;
  }
  
  let deleted = 0;
  for (const file of toDelete) {
    const filePath = path.join(logsDir, file);
    fs.unlinkSync(filePath);
    deleted++;
    console.log(`  🗑️ Removido: ${file}`);
  }
  
  if (option === '1') {
    log(`\n✅ ${deleted} relatório(s) removido(s). A pasta logs/ está vazia.`, 'green');
  } else {
    log(`\n✅ ${deleted} arquivo(s) removido(s). Mantidos os 5 relatórios mais recentes.`, 'green');
  }
}

async function askUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

async function runFullWorkflow() {
  log('\n🚀 INICIANDO WORKFLOW COMPLETO', 'green');
  console.log('─'.repeat(64));
  
  const verbose = await askUser('Modo verbose? (S/N): ');
  const isVerbose = verbose === 's' || verbose === 'sim' || verbose === 'y';
  
  const auditCmd = isVerbose 
    ? 'npm run audit:translation:verbose'
    : 'npm run audit:translation';
  
  log('\n📋 PASSO 1: Auditando...', 'cyan');
  if (!runCommand(auditCmd, 'Auditoria')) {
    log('❌ Workflow interrompido na auditoria.', 'red');
    return false;
  }
  
  const fix = await askUser('\n🔧 Deseja corrigir problemas de gênero? (S/N): ');
  if (fix !== 's' && fix !== 'sim' && fix !== 'y') {
    log('✨ Workflow concluído (sem correções).', 'green');
    return true;
  }
  
  const fixCmd = isVerbose
    ? 'npm run fix:gender:verbose'
    : 'npm run fix:gender';
  
  log('\n🔧 PASSO 2: Corrigindo problemas de gênero...', 'cyan');
  runCommand(fixCmd, 'Correção de gênero');
  
  const reaudit = await askUser('\n🔄 Deseja re-auditar após as correções? (S/N): ');
  if (reaudit === 's' || reaudit === 'sim' || reaudit === 'y') {
    log('\n📋 PASSO 3: Re-auditando...', 'cyan');
    runCommand(auditCmd, 'Re-auditoria');
  }
  
  log('\n✅ WORKFLOW CONCLUÍDO!', 'green');
  log('   Arquivos corrigidos estão em: output/fixed/', 'cyan');
  log('   Para usar, copie para input/translated/\n', 'cyan');
  
  return true;
}

async function main() {
  while (true) {
    clearScreen();
    showHeader();
    showMenu();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const choice = await new Promise((resolve) => {
      rl.question('👉 Digite o número da opção: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    
    switch (choice) {
      case '1':
        runCommand('npm run audit:translation', 'Auditoria normal');
        break;
      case '2':
        runCommand('npm run audit:translation:verbose', 'Auditoria com detalhes');
        break;
      case '3':
        runCommand('npm run fix:gender', 'Correção de gênero');
        break;
      case '4':
        runCommand('npm run fix:gender:verbose', 'Correção de gênero (verbose)');
        break;
      case '5':
        await runFullWorkflow();
        break;
      case '6':
        showLastReport();
        break;
      case '7':
        await cleanOldReports();
        break;
      case '8':
        log('\n✨ Até logo!\n', 'magenta');
        return;
      default:
        log('\n❌ Opção inválida. Tente novamente.', 'red');
    }
    
    if (choice !== '8') {
      console.log();
      console.log('─'.repeat(64));
      await askUser('\nPressione ENTER para continuar...');
    }
  }
}

main().catch(console.error);