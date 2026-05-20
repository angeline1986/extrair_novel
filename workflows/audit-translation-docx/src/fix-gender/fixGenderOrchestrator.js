#!/usr/bin/env node
// src/fix-gender/fixGenderOrchestrator.js
// Orquestrador principal do corretor de gênero com versionamento incremental

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTimestamp } from './utils.js';
import { processDocxFile } from './docxProcessor.js';
import { generateCorrectionsCsv } from './reportGenerator.js';
import config from '../config.js';
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

const logsDir = path.join(projectRoot, 'logs');
const inputFixedDir = path.join(projectRoot, 'input-fixed');
const reportOutputs = config.report.outputs || {};

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

function toProjectRelative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

function removeLegacyOutputDirs() {
  for (const dir of ['fixed', 'normalized']) {
    const legacyDir = path.join(projectRoot, 'output', dir);
    if (fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
  }
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
  const concise = process.env.AUDIT_CONCISE === '1';
  const explicitStep = process.argv.some(arg => arg.startsWith('--step='));
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const targetStep = explicitStep ? getTargetStep() : getNextVersion();
  const timestamp = getTimestamp();
  const workingInput = getWorkingInput({ resetWorkingCopy });
  const inputDir = workingInput.path;
  const versionLabel = `v${targetStep}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `audit-translation-${versionLabel}-`));
  const normalizedDir = path.join(tempDir, 'normalized');
  const fixedDir = path.join(tempDir, 'fixed');

  fs.mkdirSync(normalizedDir, { recursive: true });
  fs.mkdirSync(fixedDir, { recursive: true });
  removeLegacyOutputDirs();
  
  if (!concise) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  ATENÇÃO: O original em input/translatedGoogle/ NÃO é modificado
║  As correções vão para input-fixed/v{N}/ e output/
║                                                              ║
║  Versão: ${versionLabel}                                       ║
║  Execução: ${timestamp}                                        ║
╚══════════════════════════════════════════════════════════════╝
`);
  }

  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Pasta de entrada não encontrada: ${inputDir}`);
    process.exitCode = 1;
    return false;
  }
  
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.docx'));
  
  if (files.length === 0) {
    console.log(`ℹ️ Nenhum arquivo .docx encontrado em: ${inputDir}`);
    process.exitCode = 1;
    return false;
  }
  
  console.log(`\nVersão: ${versionLabel}`);
  console.log(`Arquivos: ${files.length}`);
  console.log(`Origem: ${toProjectRelative(inputDir)}`);
  console.log(`Destino (versão): input-fixed/${versionLabel}`);
  console.log(`Destino (final): output/`);
  
  let processed = 0;
  let hasChanges = false;
  const allCorrectionsLog = [];
  const allEntityNormalizationLog = [];
  const preprocessingReports = [];
  const entityGlossary = loadEntityGlossary();
  try {
    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const normalizedPath = path.join(normalizedDir, file);
      const outputPath = path.join(fixedDir, file.replace('.docx', '_fixed.docx'));
      const correctionsLog = [];

      console.log(`\nProcessando: ${file}`);

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

      logWorkflowEvent('ENTITIES_PREPROCESSED', {
        step: targetStep,
        file,
        stage: 'normalização de entidades',
        source: inputPath,
        changed: entityNormalization.changed,
        aliasesReplaced,
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

        console.log(`  Entidades normalizadas: ${aliasesReplaced}`);
      }

      const genderSuccess = processDocxFile(normalizedPath, outputPath, verbose && !concise, correctionsLog);

      if (!genderSuccess && entityNormalization.changed) {
        fs.copyFileSync(normalizedPath, outputPath);
      }

      const success = genderSuccess || entityNormalization.changed;
      
      if (success) {
        processed++;
        hasChanges = true;
        allCorrectionsLog.push(...correctionsLog);

        logWorkflowEvent('FIXED_FILE_CREATED', {
          step: targetStep,
          file,
          stage: 'fix-gender',
          source: normalizedPath,
          destination: outputPath,
          genderChanged: genderSuccess,
          entityOnlyFallback: !genderSuccess && entityNormalization.changed,
        });
        
        // Publicar nova versão evolutiva em input-fixed/v{N}/ e atualizar output/.
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

        logWorkflowEvent('VERSION_FILE_PUBLISHED', {
          step: targetStep,
          file,
          stage: 'publicação de versão',
          source: outputPath,
          destination: published.versionDest,
          version: `v${published.version}`,
        });

        console.log(`  Versão criada: input-fixed/v${targetStep}`);
        console.log(`  Final atualizado: output/${path.basename(published.finalOutputDest)}`);
      } else {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        console.log(`  ℹ️ Nenhuma correção necessária para ${file}`);
      }
      
    } catch (err) {
      console.error(`  ❌ Erro em ${file}: ${err.message}`);
      if (verbose) console.error(err.stack);
    }
  }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  if (reportOutputs.correctionsCsv && allCorrectionsLog.length > 0) {
    const csvFilename = `correcoes_step${targetStep}_${timestamp}`;
    generateCorrectionsCsv(allCorrectionsLog, logsDir, csvFilename);
  }

  if (allEntityNormalizationLog.length > 0 && reportOutputs.entityNormalizationJson !== false) {
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
    if (!concise) console.log(`🏷️ Log de entidades: ${entityLogPath}`);

    if (reportOutputs.entityNormalizationSummary) {
      writeEntityNormalizationSummary(summaryPath, report);
      if (!concise) console.log(`🏷️ Resumo de entidades: ${summaryPath}`);
    }
  }
  
  console.log(`\nResumo da correção:`);
  console.log(`  Arquivos processados: ${processed}/${files.length}`);
  console.log(`  Arquivos com alterações: ${hasChanges ? processed : 0}`);
  console.log(`  Versão: v${targetStep}`);
  console.log(`  Final: output/`);
  console.log(`  Relatórios: logs/`);
  
  if (hasChanges) {
    console.log(`\nPróximo passo: reauditar input-fixed/v${targetStep} e revisar o dashboard final.`);
  }

  return hasChanges;
}
