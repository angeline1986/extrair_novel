#!/usr/bin/env node
// src/fix-gender/fixGenderOrchestrator.js
// Orquestrador principal do corretor de gênero com versionamento incremental

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTimestamp } from './utils.js';
import { processDocxFile } from './docxProcessor.js';
import { generateCorrectionsCsv } from './reportGenerator.js';
import { 
  getCurrentStep, 
  setCurrentStep, 
  createVersionFromCurrent,
  createVersionFromFile,
  showVersionStatus
} from '../versionManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const inputDir = path.join(projectRoot, 'input', 'translated');
const logsDir = path.join(projectRoot, 'logs');
const versionsDir = path.join(projectRoot, 'input', 'versions');
const backupDir = path.join(projectRoot, 'input', 'backup');

// Criar diretórios necessários
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true });
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

/**
 * Obter o step alvo (pode vir de --step= ou usar o step atual)
 */
function getTargetStep() {
  const stepArg = process.argv.find(arg => arg.startsWith('--step='));
  if (stepArg) {
    const step = parseInt(stepArg.split('=')[1], 10);
    if (!isNaN(step) && step > 0) return step;
  }
  return getCurrentStep();
}

/**
 * Criar backup do arquivo original antes da correção
 */
function createBackup(filePath, filename, step) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupPath = path.join(backupDir, `${filename}.step${step}-${timestamp}.backup`);
  
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`  📋 Backup criado: ${backupPath}`);
    return backupPath;
  }
  return null;
}

/**
 * Função principal do orquestrador
 */
export async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const skipVersion = process.argv.includes('--skip-version'); // Pular criação de versão
  const targetStep = getTargetStep();
  const timestamp = getTimestamp();
  
  // Diretório de saída do backup (output/fixed/stepN_timestamp/)
  const outputDir = path.join(projectRoot, 'output', 'fixed', `step${targetStep}_${timestamp}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  ATENÇÃO: NÃO corrige pontuação, reticências ou aspas       ║
║                                                              ║
║  Step: ${targetStep}                                          ║
║  Versão: ${timestamp}                                          ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Verificar se a pasta de entrada existe
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Pasta de entrada não encontrada: ${inputDir}`);
    console.log(`   Certifique-se de que os arquivos DOCX estão em: ${inputDir}`);
    return;
  }
  
  // Listar arquivos .docx
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.docx'));
  
  if (files.length === 0) {
    console.log(`ℹ️ Nenhum arquivo .docx encontrado em: ${inputDir}`);
    return;
  }
  
  console.log(`\n🔍 Encontrados ${files.length} arquivo(s) para processar`);
  console.log(`📁 Entrada: ${inputDir}`);
  console.log(`📁 Backup (output/fixed): ${outputDir}`);
  console.log(`📁 Logs: ${logsDir}`);
  console.log(`\n${'='.repeat(60)}`);
  
  let processed = 0;
  let hasChanges = false;
  const allCorrectionsLog = [];
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace('.docx', '_fixed.docx'));
    const correctionsLog = [];
    
    console.log(`\n📄 Processando: ${file}`);
    
    try {
      // Criar backup antes de processar
      const backupPath = createBackup(inputPath, file, targetStep);
      
      // Processar o arquivo
      const success = processDocxFile(inputPath, outputPath, verbose, correctionsLog);
      
      if (success) {
        processed++;
        hasChanges = true;
        allCorrectionsLog.push(...correctionsLog);
        
        // Salvar a versão corrigida no diretório de versões (input/versions/vN/)
        if (!skipVersion) {
          const versionCreated = createVersionFromFile(outputPath, file, targetStep);
          if (versionCreated) {
            console.log(`  📁 Versão v${targetStep} salva em: input/versions/v${targetStep}/`);
          }
        }
        
        // Também salvar em translated-fixed/ (versão final sem sufixo _fixed)
        const translatedFixedDir = path.join(projectRoot, 'input', 'translated-fixed');
        if (!fs.existsSync(translatedFixedDir)) {
          fs.mkdirSync(translatedFixedDir, { recursive: true });
        }
        const finalDest = path.join(translatedFixedDir, file);
        fs.copyFileSync(outputPath, finalDest);
        console.log(`  📁 Versão final: ${finalDest}`);
        
        // Se esta não é a versão atual, perguntar se quer aplicar
        if (targetStep !== getCurrentStep()) {
          console.log(`  ℹ️ Esta é a versão v${targetStep}, mas o step atual é v${getCurrentStep()}`);
          console.log(`  Para usar esta versão, execute: npm run version:goto -- ${targetStep}`);
        }
      } else {
        console.log(`  ℹ️ Nenhuma correção necessária para ${file}`);
      }
      
    } catch (err) {
      console.error(`  ❌ Erro em ${file}: ${err.message}`);
      if (verbose) console.error(err.stack);
    }
  }
  
  // Gerar CSV com todas as correções
  if (allCorrectionsLog.length > 0) {
    const csvFilename = `correcoes_step${targetStep}_${timestamp}`;
    generateCorrectionsCsv(allCorrectionsLog, logsDir, csvFilename);
  }
  
  // Resumo final
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 RESUMO:`);
  console.log(`   Arquivos processados: ${processed}/${files.length}`);
  console.log(`   Arquivos com alterações: ${hasChanges ? processed : 0}`);
  console.log(`   Step: ${targetStep}`);
  console.log(`   Backup: ${outputDir}`);
  if (!skipVersion) {
    console.log(`   Versão salva: input/versions/v${targetStep}/`);
  }
  console.log(`   Versão final: input/translated-fixed/`);
  console.log(`   Logs: ${logsDir}/correcoes_*.csv`);
  
  if (hasChanges) {
    console.log(`\n✨ PRÓXIMOS PASSOS:`);
    console.log(`   1. Validar a correção: npm run audit:translation`);
    console.log(`   2. Se estiver satisfeita, avance: npm run version:next`);
    console.log(`   3. Se precisar ajustar, corrija novamente: npm run fix:gender -- --step=${targetStep + 1}`);
    console.log(`   4. Ver status das versões: npm run version:status`);
  } else if (processed > 0) {
    console.log(`\n✨ Nenhuma correção necessária. O arquivo já está ok!`);
  }
  
  // Mostrar status das versões
  if (files.length > 0) {
    showVersionStatus(files[0]);
  }
}