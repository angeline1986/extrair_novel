#!/usr/bin/env node
// src/fix-gender/fixGenderOrchestrator.js
// Orquestrador principal do corretor de gênero com versionamento incremental

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTimestamp } from './utils.js';
import { processDocxFile } from './docxProcessor.js';
import { generateCorrectionsCsv } from './reportGenerator.js';
import { getCurrentStep, createVersionFromFile, getCorrectionSourcePath } from '../version/versionCore.js';
import { logWorkflowEvent } from '../observability/workflowLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const inputDir = path.join(projectRoot, 'input', 'translatedGoogle');  // APENAS LEITURA
const logsDir = path.join(projectRoot, 'logs');
const inputFixedDir = path.join(projectRoot, 'input-fixed');
const auditadaDir = path.join(projectRoot, 'output', 'auditada');

// Criar diretórios necessários
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(inputFixedDir)) fs.mkdirSync(inputFixedDir, { recursive: true });
if (!fs.existsSync(auditadaDir)) fs.mkdirSync(auditadaDir, { recursive: true });

function getTargetStep() {
  const stepArg = process.argv.find(arg => arg.startsWith('--step='));
  if (stepArg) {
    const step = parseInt(stepArg.split('=')[1], 10);
    if (!isNaN(step) && step > 0) return step;
  }
  return getCurrentStep();
}

export function getInputDir(step, filename = 'file.docx') {
  return getCorrectionSourcePath(step, filename).sourcePath;
}

export async function runFixGender({ step, verbose = false } = {}) {
  const originalArgv = process.argv;
  const nodePath = process.argv[0];
  const scriptPath = process.argv[1];
  const args = [nodePath, scriptPath, `--step=${step ?? getCurrentStep()}`];
  if (verbose) args.push('--verbose');
  process.argv = args;
  try {
    return await main();
  } finally {
    process.argv = originalArgv;
  }
}

export async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const targetStep = getTargetStep();
  const timestamp = getTimestamp();
  
  const outputBackupDir = path.join(projectRoot, 'output', 'fixed', `step${targetStep}_${timestamp}`);
  
  if (!fs.existsSync(outputBackupDir)) {
    fs.mkdirSync(outputBackupDir, { recursive: true });
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  ATENÇÃO: O original em input/translatedGoogle/ NÃO é modificado
║  As correções vão para input-fixed/v{N}/ e output/auditada/
║                                                              ║
║  Step: ${targetStep}                                          ║
║  Versão: ${timestamp}                                          ║
╚══════════════════════════════════════════════════════════════╝
`);

  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Pasta de entrada não encontrada: ${inputDir}`);
    return;
  }
  
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.docx'));
  
  if (files.length === 0) {
    console.log(`ℹ️ Nenhum arquivo .docx encontrado em: ${inputDir}`);
    return;
  }
  
  console.log(`\n🔍 Encontrados ${files.length} arquivo(s) para processar`);
  console.log(`📁 Entrada (original): ${inputDir} (NÃO será modificado)`);
  console.log(`📁 Backup: ${outputBackupDir}`);
  console.log(`📁 Versão versionada: ${inputFixedDir}/v${targetStep}/`);
  console.log(`📁 Versão final auditada: ${auditadaDir}/`);
  console.log(`📁 Logs: ${logsDir}`);
  console.log(`\n${'='.repeat(60)}`);
  
  let processed = 0;
  let hasChanges = false;
  const allCorrectionsLog = [];
  
  for (const file of files) {
    const sourceInfo = getCorrectionSourcePath(targetStep, file);
    const inputPath = sourceInfo.sourcePath;
    const outputPath = path.join(outputBackupDir, file.replace('.docx', '_fixed.docx'));
    const correctionsLog = [];

    console.log(`
📄 Processando: ${file}`);
    console.log(`   📁 Origem da correção: ${inputPath}`);

    if (sourceInfo.sourceType === 'original_fallback') {
      console.warn(`   ⚠️ Versão anterior v${sourceInfo.previousStep} não encontrada. Usando original como fallback.`);
      logWorkflowEvent('CORRECTION_SOURCE_FALLBACK', {
        step: targetStep,
        reason: sourceInfo.reason,
        fallbackPath: inputPath,
      });
    }

    logWorkflowEvent('CORRECTION_SOURCE', {
      step: targetStep,
      sourcePath: inputPath,
      sourceType: sourceInfo.sourceType,
    });

    try {
      const success = processDocxFile(inputPath, outputPath, verbose, correctionsLog);
      
      if (success) {
        processed++;
        hasChanges = true;
        allCorrectionsLog.push(...correctionsLog);
        
        // 1. Salvar versão versionada em input-fixed/v{N}/
        createVersionFromFile(outputPath, file, targetStep);

        // 2. Atualizar pointer current/ para última versão
        const currentDir = path.join(inputFixedDir, 'current');
        if (!fs.existsSync(currentDir)) {
          fs.mkdirSync(currentDir, { recursive: true });
        }
        const currentDest = path.join(currentDir, file);
        fs.copyFileSync(outputPath, currentDest);
        console.log(`  📁 Última versão atualizada: ${currentDest}`);
        
        // 3. Salvar versão final auditada em output/auditada/
        const auditadaDest = path.join(auditadaDir, file);
        fs.copyFileSync(outputPath, auditadaDest);
        console.log(`  📁 Versão final auditada: ${auditadaDest}`);

        
      } else {
        console.log(`  ℹ️ Nenhuma correção necessária para ${file}`);
      }
      
    } catch (err) {
      console.error(`  ❌ Erro em ${file}: ${err.message}`);
      if (verbose) console.error(err.stack);
    }
  }
  
  if (allCorrectionsLog.length > 0) {
    const csvFilename = `correcoes_step${targetStep}_${timestamp}`;
    generateCorrectionsCsv(allCorrectionsLog, logsDir, csvFilename);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 RESUMO:`);
  console.log(`   Arquivos processados: ${processed}/${files.length}`);
  console.log(`   Arquivos com alterações: ${hasChanges ? processed : 0}`);
  console.log(`   Step: ${targetStep}`);
  console.log(`   Backup: ${outputBackupDir}`);
  console.log(`   Versão versionada: ${inputFixedDir}/v${targetStep}/`);
  console.log(`   Versão final auditada: ${auditadaDir}/`);
  console.log(`   Logs: ${logsDir}/correcoes_*.csv`);
  
  if (hasChanges) {
    console.log(`\n✨ PRÓXIMOS PASSOS:`);
    console.log(`   1. Verificar a versão final em: ${auditadaDir}/`);
    console.log(`   2. Avançar para próximo step: npm run version:next`);
    console.log(`   3. Ver status das versões: npm run version:status`);
  }
}