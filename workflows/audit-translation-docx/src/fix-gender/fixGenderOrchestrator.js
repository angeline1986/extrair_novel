#!/usr/bin/env node
// src/fix-gender/fixGenderOrchestrator.js
// Orquestrador principal do corretor de gênero com versionamento incremental

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTimestamp } from './utils.js';
import { processDocxFile } from './docxProcessor.js';
import { generateCorrectionsCsv } from './reportGenerator.js';
import { getCorrectionSourcePath, getCurrentStep } from '../version/versionCore.js';
import { logWorkflowEvent } from '../observability/workflowLog.js';
import { loadEntityGlossary, normalizeEntitiesInDocx } from '../entities/index.js';
import {
  getNextVersion,
  getWorkingInput,
  publishVersion,
} from '../version/versionWorkflow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const originalInputDir = path.join(projectRoot, 'input', 'translatedGoogle');  // APENAS LEITURA
const logsDir = path.join(projectRoot, 'logs');
const inputFixedDir = path.join(projectRoot, 'input-fixed');

// Criar diretórios necessários
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(inputFixedDir)) fs.mkdirSync(inputFixedDir, { recursive: true });

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

function aggregateEntityChanges(changes) {
  const byAlias = new Map();

  for (const change of changes) {
    const alias = change.alias || change.found;
    const key = `${change.canonical}::${alias}`;
    const current = byAlias.get(key) || {
      canonical: change.canonical,
      alias,
      found: alias,
      occurrences: 0,
      action: change.action || 'replace',
      examples: [],
    };

    current.occurrences += change.occurrences;
    current.examples.push(...(change.examples || []));
    current.examples = current.examples.slice(0, 5);
    byAlias.set(key, current);
  }

  return [...byAlias.values()].sort((a, b) =>
    a.canonical.localeCompare(b.canonical) || a.alias.localeCompare(b.alias)
  );
}

function writeEntityNormalizationSummary(summaryPath, report) {
  const lines = [
    'NORMALIZAÇÃO DE ENTIDADES',
    '-------------------------',
    'Executada antes do fix-gender: sim',
    `Aliases substituídos: ${report.preprocessing.aliasesReplaced}`,
    '',
  ];

  for (const replacement of report.entityNormalization.replacements) {
    lines.push(`- ${replacement.alias} → ${replacement.canonical} (${replacement.occurrences})`);
  }

  if (report.entityNormalization.replacements.length === 0) {
    lines.push('- Nenhum alias encontrado.');
  }

  lines.push('');
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
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
  const explicitStep = process.argv.some(arg => arg.startsWith('--step='));
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const targetStep = explicitStep ? getTargetStep() : getNextVersion();
  const timestamp = getTimestamp();
  const workingInput = getWorkingInput({ resetWorkingCopy });
  const inputDir = workingInput.path;
  
  const outputBackupDir = path.join(projectRoot, 'output', 'fixed', `step${targetStep}_${timestamp}`);
  const normalizedDir = path.join(projectRoot, 'output', 'normalized', `step${targetStep}_${timestamp}`);
  
  if (!fs.existsSync(outputBackupDir)) {
    fs.mkdirSync(outputBackupDir, { recursive: true });
  }
  if (!fs.existsSync(normalizedDir)) {
    fs.mkdirSync(normalizedDir, { recursive: true });
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  ATENÇÃO: O original em input/translatedGoogle/ NÃO é modificado
║  As correções vão para input-fixed/v{N}/ e input-fixed/current/
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
  console.log(`📁 Entrada de trabalho: ${inputDir}`);
  console.log(`📁 Base Google: ${originalInputDir} (NÃO será modificado)`);
  console.log(`📁 Pré-processamento de entidades: ${normalizedDir}`);
  console.log(`📁 Backup: ${outputBackupDir}`);
  console.log(`📁 Versão versionada: ${inputFixedDir}/v${targetStep}/`);
  console.log(`📁 Última versão corrigida: ${inputFixedDir}/current/`);
  console.log(`📁 Logs: ${logsDir}`);
  console.log(`\n${'='.repeat(60)}`);
  
  let processed = 0;
  let hasChanges = false;
  const allCorrectionsLog = [];
  const allEntityNormalizationLog = [];
  const preprocessingReports = [];
  const entityGlossary = loadEntityGlossary();
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const normalizedPath = path.join(normalizedDir, file);
    const outputPath = path.join(outputBackupDir, file.replace('.docx', '_fixed.docx'));
    const correctionsLog = [];

    console.log(`
📄 Processando: ${file}`);
    console.log(`   📁 Origem da correção: ${inputPath}`);

    logWorkflowEvent('CORRECTION_SOURCE', {
      step: targetStep,
      sourcePath: inputPath,
      sourceType: workingInput.source,
    });

    try {
      fs.copyFileSync(inputPath, normalizedPath);

      const entityNormalization = normalizeEntitiesInDocx(normalizedPath, entityGlossary, {
        maxExamples: 5,
      });
      const entityReplacements = aggregateEntityChanges(entityNormalization.changes);
      const aliasesReplaced = entityReplacements.reduce(
        (sum, replacement) => sum + replacement.occurrences,
        0
      );

      preprocessingReports.push({
        file,
        step: 'step2FixGender',
        preprocessing: {
          normalizeEntities: true,
          aliasesFound: entityReplacements.length,
          aliasesReplaced,
        },
        entityNormalization: {
          replacements: entityReplacements.map((replacement) => ({
            canonical: replacement.canonical,
            alias: replacement.alias,
            occurrences: replacement.occurrences,
          })),
        },
      });

      if (entityNormalization.changed) {
        for (const change of entityReplacements) {
          allCorrectionsLog.push({
            before: change.alias,
            after: change.canonical,
            type: 'pré-normalização de entidade',
            pattern: change.alias,
          });
          allEntityNormalizationLog.push({
            file,
            canonical: change.canonical,
            alias: change.alias,
            found: change.alias,
            occurrences: change.occurrences,
            action: 'replace_before_fix_gender',
            examples: change.examples,
          });
        }

        logWorkflowEvent('ENTITY_NORMALIZED', {
          step: targetStep,
          phase: 'before_fix_gender',
          file,
          changes: entityReplacements.length,
          occurrences: aliasesReplaced,
          manualReview: entityNormalization.manualReview,
        });

        console.log(`  🏷️ Entidades normalizadas antes do fix-gender: ${aliasesReplaced} ocorrência(s)`);
      }

      const genderSuccess = processDocxFile(normalizedPath, outputPath, verbose, correctionsLog);

      if (!genderSuccess && entityNormalization.changed) {
        fs.copyFileSync(normalizedPath, outputPath);
      }

      const success = genderSuccess || entityNormalization.changed;
      
      if (success) {
        processed++;
        hasChanges = true;
        allCorrectionsLog.push(...correctionsLog);
        
        // 1. Publicar nova versão evolutiva em input-fixed/v{N}/ e current/
        const published = publishVersion({
          source: inputDir,
          correctedFile: outputPath,
          version: targetStep,
          step: targetStep,
          metadata: {
            normalizedBeforeFixGender: true,
            aliasesReplaced,
          },
        });

        console.log(`  📁 Versão v${targetStep} criada: ${published.versionDest}`);
        console.log(`  📁 Última versão atualizada: ${published.currentDest}`);
      } else {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
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

  if (allEntityNormalizationLog.length > 0) {
    const entityLogPath = path.join(logsDir, `entity-normalization-${timestamp}.json`);
    const summaryPath = path.join(logsDir, `entity-normalization-summary-${timestamp}.txt`);
    const aliasesReplaced = allEntityNormalizationLog.reduce(
      (sum, change) => sum + change.occurrences,
      0
    );
    const report = {
      timestamp,
      step: 'step2FixGender',
      preprocessing: {
        normalizeEntities: true,
        aliasesFound: allEntityNormalizationLog.length,
        aliasesReplaced,
      },
      entityNormalization: {
        replacements: allEntityNormalizationLog.map((change) => ({
          canonical: change.canonical,
          alias: change.alias,
          occurrences: change.occurrences,
        })),
      },
      files: preprocessingReports,
    };

    fs.writeFileSync(entityLogPath, JSON.stringify({
      timestamp,
      step: 'step2FixGender',
      preprocessing: report.preprocessing,
      entityNormalization: report.entityNormalization,
      changes: allEntityNormalizationLog,
    }, null, 2), 'utf8');
    writeEntityNormalizationSummary(summaryPath, report);
    console.log(`🏷️ Log de entidades: ${entityLogPath}`);
    console.log(`🏷️ Resumo de entidades: ${summaryPath}`);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 RESUMO:`);
  console.log(`   Arquivos processados: ${processed}/${files.length}`);
  console.log(`   Arquivos com alterações: ${hasChanges ? processed : 0}`);
  console.log(`   Step: ${targetStep}`);
  console.log(`   Pré-normalização: ${normalizedDir}`);
  console.log(`   Backup: ${outputBackupDir}`);
  console.log(`   Versão versionada: ${inputFixedDir}/v${targetStep}/`);
  console.log(`   Última versão corrigida: ${inputFixedDir}/current/`);
  console.log(`   Logs: ${logsDir}/correcoes_*.csv`);
  
  if (hasChanges) {
    console.log(`\n✨ PRÓXIMOS PASSOS:`);
    console.log(`   1. Verificar a versão final em: ${inputFixedDir}/current/`);
    console.log(`   2. Avançar para próximo step: npm run version:next`);
    console.log(`   3. Ver status das versões: npm run version:status`);
  }
}
