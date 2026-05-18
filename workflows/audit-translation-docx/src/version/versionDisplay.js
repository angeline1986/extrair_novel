// src/version/versionDisplay.js
// Exibição de status e ajuda

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCurrentStep, listVersions, getVersionPath } from './versionCore.js';

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

/**
 * Mostrar status das versões no console
 * @param {string} filename - Nome do arquivo
 */
export function showVersionStatus(filename) {
  const versions = listVersions();
  const currentStep = getCurrentStep();
  const currentFilePath = path.join(translatedDir, filename);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 STATUS DAS VERSÕES');
  console.log('='.repeat(60));
  console.log(`\n   📄 Arquivo: ${filename}`);
  console.log(`   📍 Step atual: ${currentStep}`);
  console.log(`   💾 Original: ${fs.existsSync(currentFilePath) ? (fs.statSync(currentFilePath).size / 1024).toFixed(1) : 'N/A'} KB`);
  console.log(`   📁 Pasta: input-fixed/`);
  console.log(`   📁 Versões: ${versions.length > 0 ? versions.join(', ') : 'nenhuma'}`);
  console.log('');
  
  if (versions.length === 0) {
    console.log('   ℹ️ Nenhuma versão salva. Execute "npm run fix:gender" para criar a primeira versão.');
  } else {
    console.log('   📋 Histórico:');
    console.log('');
    for (const step of versions) {
      const versionPath = getVersionPath(step, filename);
      if (fs.existsSync(versionPath)) {
        const stats = fs.statSync(versionPath);
        const date = stats.mtime.toLocaleString('pt-BR');
        const size = (stats.size / 1024).toFixed(1);
        const isCurrent = step === currentStep;
        console.log(`   ${isCurrent ? '👉' : '  '} v${step}: ${date} (${size} KB) ${isCurrent ? '[ATUAL]' : ''}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Mostrar ajuda dos comandos
 * @param {string} filename - Nome do arquivo
 */
export function showHelp(filename) {
  const currentStep = getCurrentStep();
  
  console.log(`
📋 COMANDOS DISPONÍVEIS:

  npm run version:status   - Mostrar status das versões
  npm run version:current  - Mostrar step atual
  npm run version:list     - Listar versões disponíveis
  
  npm run version:next     - Avançar para próximo step
  npm run version:prev     - Voltar para step anterior
  npm run version:goto -- 3 - Ir para step específico
  
  npm run version:diff -- 1 2 - Comparar duas versões
  npm run version:clean    - Limpar versões antigas
  npm run version:create   - Criar versão manual

📁 Estrutura:
  input/translated/     → Original do Google (NUNCA modificado)
  input-fixed/v1/       → Primeira correção
  input-fixed/v2/       → Segunda correção

📄 Arquivo: ${filename}
📍 Step atual: ${currentStep}
`);
}