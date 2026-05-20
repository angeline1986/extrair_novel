#!/usr/bin/env node
// src/index.js - Orquestrador principal

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuração
import config from './config.js';
import { log, naturalCompare, extractChapterRange } from './utils.js';
import { readAllDocxFromDir } from './docxReader.js';
import { alignChapters } from './aligner.js';
import { runStructuralChecks } from './checks/structural.js';
import { detectGoogleTranslateIssues } from './checks/gtPatterns.js';
import { initCache, saveCache, reviewSuspiciousItems } from './ollamaReviewer.js';
import { generateReports } from './reportWriter/reportGenerator.js';
import {
  auditEntities,
  extractEntitiesFromSource,
  loadEntityGlossary,
} from './entities/index.js';
import { getVersionWorkflowInfo, getWorkingInput } from './version/versionWorkflow.js';

// Configurar diretórios
const sourceDir = path.resolve(__dirname, config.files.sourceDir);
const outputDir = path.resolve(__dirname, config.files.outputDir);
const logsDir = path.resolve(__dirname, config.files.logsDir);

// Criar diretórios se não existirem
[outputDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Inicializar cache do Ollama
initCache();

function displayPath(filePath) {
  if (process.env.AUDIT_CONCISE !== '1') return filePath;

  const relative = path.relative(path.resolve(__dirname, '..'), filePath).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : filePath;
}

async function main() {
  const verbose = process.argv.includes('--verbose');
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const workingInputArg = process.argv.find((arg) => arg.startsWith('--working-input='));
  const workingInput = workingInputArg
    ? {
        path: path.resolve(workingInputArg.split('=').slice(1).join('=')),
        relativePath: workingInputArg.split('=').slice(1).join('='),
        source: 'explicit',
        reason: 'explicit working input requested',
      }
    : getWorkingInput({ resetWorkingCopy });
  const translatedDir = workingInput.path;
  const versionWorkflow = getVersionWorkflowInfo({ resetWorkingCopy });

  log('=== INICIANDO AUDITORIA DE TRADUÇÕES ===');
  log(`Originais: ${sourceDir}`);
  log(`Traduções: ${translatedDir}`);
  log(`Working source: ${workingInput.relativePath}`);
  log(`Saída: ${outputDir}`);
  
  // 1. Ler todos os DOCX
  log('Lendo arquivos originais...');
  const sourceDocs = readAllDocxFromDir(sourceDir);
  log(`Encontrados ${sourceDocs.length} arquivos originais`);
  
  log('Lendo arquivos traduzidos...');
  const translatedDocs = readAllDocxFromDir(translatedDir);
  log(`Encontrados ${translatedDocs.length} arquivos traduzidos`);
  
  if (sourceDocs.length === 0) {
    log('Nenhum arquivo original encontrado!', 'ERROR');
    process.exit(1);
  }
  
  // 2. Alinhar arquivos
  log('Alinhando documentos...');
  const alignedDocs = alignChapters(sourceDocs, translatedDocs);
  
  // 3. Executar verificações
  log('Executando verificações estruturais...');
  const allIssues = [];
  const allWarnings = [];
  const suspiciousItems = [];
  const entityGlossary = loadEntityGlossary();
  const entityResults = [];
  
  for (const doc of alignedDocs) {
    if (doc.alignment === 'missing') {
      allIssues.push({
        type: 'missing_file',
        severity: 'FAIL',
        filename: doc.source.filename,
      });
      continue;
    }
    
    // Verificações estruturais
    const structural = runStructuralChecks(doc.source, doc.translation, doc.chapters);
    allIssues.push(...structural.issues);
    allWarnings.push(...structural.warnings);
    
    // Verificações específicas do Google Tradutor
    const gtIssues = detectGoogleTranslateIssues(doc.translation.rawText, doc.source.rawText);
    allIssues.push(...gtIssues.issues);
    allWarnings.push(...gtIssues.warnings);

    // Consistência de nomes/personagens com glossário canônico.
    const entityAudit = auditEntities(doc.translation.rawText, entityGlossary);
    const sourceEntityCandidates = extractEntitiesFromSource(doc.source.filePath).slice(0, 30);

    entityResults.push({
      file: doc.translation.filename,
      sourceFile: doc.source.filePath,
      translatedFile: doc.translation.filePath,
      sourceEntityCandidates,
      ...entityAudit,
    });

    for (const issue of entityAudit.entityIssues) {
      allWarnings.push({
        type: issue.type,
        severity: issue.severity,
        description: `${issue.canonical} apareceu como ${issue.found}`,
        details: {
          canonical: issue.canonical,
          found: issue.found,
          suggestion: issue.suggestion,
        },
        occurrences: issue.occurrences,
        examples: issue.examples || [],
      });
    }
    
    // Coletar itens suspeitos para revisão com Ollama
    for (const chapter of doc.chapters) {
      if (chapter.matchType === 'matched' && chapter.confidence < 0.6) {
        // Encontrar o texto real do capítulo
        const sourceChapter = doc.source.paragraphs.slice(
          chapter.sourceIndex * 10, // Aproximação
          (chapter.sourceIndex + 1) * 10
        ).join('\n\n');
        
        const translationChapter = doc.translation.paragraphs.slice(
          chapter.translationIndex * 10,
          (chapter.translationIndex + 1) * 10
        ).join('\n\n');
        
        suspiciousItems.push({
          type: 'low_confidence_chapter',
          sourceTitle: chapter.sourceTitle,
          translationTitle: chapter.translationTitle,
          sourceText: sourceChapter,
          translationText: translationChapter,
          confidence: chapter.confidence,
        });
      }
    }
  }
  
  // 4. Revisar itens suspeitos com Ollama (apenas se houver)
  let ollamaResults = [];
  if (suspiciousItems.length > 0 && config.ollama.model) {
    log(`Revisando ${suspiciousItems.length} itens suspeitos com Ollama...`);
    ollamaResults = await reviewSuspiciousItems(suspiciousItems);
    saveCache();
  } else {
    log('Nenhum item suspeito para revisão com Ollama');
  }
  
  // 5. Gerar relatórios
  log('Gerando relatórios...');
  const report = generateReports({
    sourceDocs,
    translatedDocs,
    alignedDocs,
    allIssues,
    allWarnings,
    ollamaResults,
    entityResults,
    versionWorkflow: {
      ...versionWorkflow,
      workingInput: workingInput.relativePath,
      workingInputReason: workingInput.reason,
    },
    config,
  });
  
  // 6. Status final
  const hasFail = allIssues.some(i => i.severity === 'FAIL');
  const hasWarn = allIssues.some(i => i.severity === 'WARN') || allWarnings.length > 0;
  
  log('=== AUDITORIA CONCLUÍDA ===');
  log(`Status: ${hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'OK'}`);
  log(`Issues: ${allIssues.length} | Warnings: ${allWarnings.length}`);
  log(`Relatórios: ${displayPath(logsDir)}`);
  log(`Dashboard HTML: ${displayPath(path.join(logsDir, 'audit-dashboard-latest.html'))}`);
  
  process.exit(hasFail ? 1 : 0);
}

// Executar
main().catch(err => {
  log(`Erro fatal: ${err.message}`, 'ERROR');
  console.error(err);
  process.exit(1);
});
