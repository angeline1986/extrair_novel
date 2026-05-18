// src/version/versionCommands.js
// CLI - processamento de comandos

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getCurrentStep, 
  setCurrentStep, 
  listVersions,
  getVersionPath 
} from './versionCore.js';
import { 
  restoreVersion, 
  gotoVersion, 
  nextVersion, 
  prevVersion, 
  cleanOldVersions, 
  createVersionFromCurrent 
} from './versionIO.js';
import { showVersionStatus, showHelp } from './versionDisplay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

let config;
try {
  const configModule = await import('../config.js');
  config = configModule.default;
} catch (err) {
  config = {
    files: {
      translatedDir: path.join(projectRoot, 'input', 'translated'),
    },
  };
}

const translatedDir = config.files.translatedDir;

function getFirstDocxFile() {
  if (!fs.existsSync(translatedDir)) return null;
  const files = fs.readdirSync(translatedDir).filter(f => f.toLowerCase().endsWith('.docx'));
  return files.length > 0 ? files[0] : null;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function showHeader() {
  log('\n╔══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║              GERENCIADOR DE VERSÕES - STEP                   ║', 'cyan');
  log('║                                                              ║', 'cyan');
  log('║  Versões corrigidas em: input-fixed/v1, v2, v3...           ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();
}

/**
 * Processar comando diff
 */
async function processDiff(step1, step2, filename) {
  const path1 = getVersionPath(step1, filename);
  const path2 = getVersionPath(step2, filename);
  
  if (!fs.existsSync(path1)) {
    log(`❌ Versão v${step1} não encontrada`, 'red');
    return false;
  }
  if (!fs.existsSync(path2)) {
    log(`❌ Versão v${step2} não encontrada`, 'red');
    return false;
  }
  
  const stats1 = fs.statSync(path1);
  const stats2 = fs.statSync(path2);
  
  console.log(`\n📊 Comparando v${step1} vs v${step2}`);
  console.log('─'.repeat(50));
  console.log(`\n   v${step1}: ${stats1.mtime.toLocaleString('pt-BR')} (${(stats1.size / 1024).toFixed(1)} KB)`);
  console.log(`   v${step2}: ${stats2.mtime.toLocaleString('pt-BR')} (${(stats2.size / 1024).toFixed(1)} KB)`);
  console.log(`\n   📁 ${path1}`);
  console.log(`   📁 ${path2}`);
  return true;
}

/**
 * Processar comando goto com confirmação
 */
async function processGoto(targetStep, filename) {
  const versions = listVersions();
  if (!versions.includes(targetStep)) {
    log(`❌ Versão v${targetStep} não encontrada`, 'red');
    log(`   Disponíveis: ${versions.join(', ')}`, 'yellow');
    return false;
  }
  return gotoVersion(targetStep, filename);
}

/**
 * Função principal - processa argumentos da linha de comando
 */
export async function runVersionCommand() {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];
  const filename = getFirstDocxFile();

  if (!filename && command !== 'help' && command !== '--help' && command !== '-h') {
    log('❌ Nenhum arquivo .docx encontrado em input/translated/', 'red');
    process.exit(1);
  }

  showHeader();

  switch (command) {
    case 'status':
    case 'list':
      showVersionStatus(filename);
      break;
      
    case 'current':
      log(`\n📌 Step atual: ${getCurrentStep()}`, 'green');
      break;
      
    case 'next':
      log('\n➡️ Avançando...', 'cyan');
      await nextVersion(filename);
      break;
      
    case 'prev':
      log('\n⬅️ Voltando...', 'cyan');
      await prevVersion(filename);
      break;
      
    case 'goto':
      const targetStep = parseInt(arg1);
      if (isNaN(targetStep)) {
        log('❌ Uso: npm run version:goto -- <step>', 'red');
        process.exit(1);
      }
      await processGoto(targetStep, filename);
      break;
      
    case 'diff':
      const step1 = parseInt(arg1);
      const step2 = parseInt(arg2);
      if (isNaN(step1) || isNaN(step2)) {
        log('❌ Uso: npm run version:diff -- <step1> <step2>', 'red');
        process.exit(1);
      }
      await processDiff(step1, step2, filename);
      break;
      
    case 'clean':
      const keepCount = arg1 ? parseInt(arg1) : 5;
      cleanOldVersions(keepCount, filename);
      break;
      
    case 'create':
      log('\n📝 Criando nova versão...', 'cyan');
      const newStep = getCurrentStep() + 1;
      const success = createVersionFromCurrent(filename, newStep);
      if (success) {
        setCurrentStep(newStep);
        log(`\n✅ Versão v${newStep} criada!`, 'green');
      }
      break;
      
    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp(filename);
      break;
  }
}