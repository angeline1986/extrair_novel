#!/usr/bin/env node
// src/fix-gender/fixGenderOrchestrator.js
// Orquestrador principal do corretor de gênero

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTimestamp } from './utils.js';
import { processDocxFile } from './docxProcessor.js';
import { generateCorrectionsCsv } from './reportGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const inputDir = path.join(projectRoot, 'input', 'translated');
const logsDir = path.join(projectRoot, 'logs');

const timestamp = getTimestamp();
const outputDir = path.join(projectRoot, 'output', 'fixed', timestamp);

// Criar diretórios
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Diretório para arquivos corrigidos (versão final)
const translatedFixedDir = path.join(projectRoot, 'input', 'translated-fixed');
if (!fs.existsSync(translatedFixedDir)) fs.mkdirSync(translatedFixedDir, { recursive: true });

export async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  ATENÇÃO: NÃO corrige pontuação, reticências ou aspas       ║
║                                                              ║
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
  console.log(`📁 Entrada: ${inputDir}`);
  console.log(`📁 Saída (versões): ${outputDir}`);
  console.log(`📁 Saída (final): ${translatedFixedDir}`);
  console.log(`📁 Logs: ${logsDir}`);
  console.log(`\n${'='.repeat(60)}`);
  
  let processed = 0;
  const allCorrectionsLog = [];
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace('.docx', '_fixed.docx'));
    const correctionsLog = [];
    
    try {
      const success = processDocxFile(inputPath, outputPath, verbose, correctionsLog);
      if (success) {
        processed++;
        allCorrectionsLog.push(...correctionsLog);
        
        // Copiar para translated-fixed/ (versão final sem sufixo _fixed)
        const finalDest = path.join(translatedFixedDir, file);
        fs.copyFileSync(outputPath, finalDest);
        console.log(`  📁 Versão final: ${finalDest}`);
      }
    } catch (err) {
      console.error(`  ❌ Erro em ${file}: ${err.message}`);
    }
  }
  
  // Gerar CSV com todas as correções
  generateCorrectionsCsv(allCorrectionsLog, logsDir, timestamp);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 RESUMO:`);
  console.log(`   Arquivos processados: ${processed}/${files.length}`);
  console.log(`   Pasta da versão: ${timestamp}`);
  console.log(`   Versões: ${outputDir}`);
  console.log(`   Versão final: ${translatedFixedDir}/`);
  console.log(`   Logs: ${logsDir}/correcoes_*.csv`);
  
  if (processed > 0) {
    console.log(`\n✨ Arquivos corrigidos disponíveis em:`);
    console.log(`   📁 ${translatedFixedDir}/`);
  }
}
