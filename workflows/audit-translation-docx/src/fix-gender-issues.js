#!/usr/bin/env node
// src/fix-gender-issues.js
// Corrige problemas comuns de gênero do Google Tradutor em arquivos DOCX

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const inputDir = path.join(projectRoot, 'input', 'translated');
const outputDir = path.join(projectRoot, 'output', 'fixed');
const logDir = path.join(projectRoot, 'logs');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Correções de gênero (usando funções em vez de $1 para evitar caracteres literais)
const corrections = [
  {
    pattern: /\bo\s+(diferente|mesma|melhor|pior|primeira|última|próxima)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'advérbio feminino com artigo masculino'
  },
  {
    pattern: /\ba\s+(computador|sistema|problema|programa|documento|texto|capítulo|parágrafo|processo|método|resultado|dado|arquivo|código|teste|exemplo|caso|tempo|espaço|valor|número|nome|lugar|mundo|ano|dia|mês|trabalho|livro|artigo|site|link|botão|menu|backup|servidor|cliente|usuário)\b/gi,
    replace: (match, word) => `o ${word}`,
    description: 'substantivo masculino com artigo feminino'
  },
  {
    pattern: /\bo\s+(grande|pequena|alta|baixa|nova|antiga|bonita|feia|rápida|lenta|fácil|difícil|clara|escura|quente|fria|seca|molhada|limpa|suja)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'adjetivo feminino com artigo masculino'
  },
  {
    pattern: /\bo\s+(casa|mesa|cadeira|porta|janela|parede|cozinha|sala|rua|estrada|ponte|floresta|praia|montanha|ilha|cidade|vila|aldeia|escola|faculdade|universidade|empresa|loja|farmácia|padaria|igreja|biblioteca|praça)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'substantivo feminino com artigo masculino'
  },
  {
    pattern: /\bo\s+mesma\b/gi,
    replace: () => 'a mesma',
    description: '"o mesma" → "a mesma"'
  },
  {
    pattern: /\ba\s+mesmo\b/gi,
    replace: () => 'o mesmo',
    description: '"a mesmo" → "o mesmo"'
  },
  {
    pattern: /\bum\s+(casa|mesa|cadeira|porta|janela|parede|cozinha|sala|rua|estrada|ponte|floresta|praia|montanha|ilha|cidade|vila|aldeia|escola|faculdade|universidade|empresa|loja|farmácia|padaria|igreja|biblioteca|praça)\b/gi,
    replace: (match, word) => `uma ${word}`,
    description: 'substantivo feminino com artigo indefinido masculino'
  },
  {
    pattern: /\buma\s+(computador|sistema|problema|programa|documento|texto|capítulo|parágrafo|processo|método|resultado|dado|arquivo|código|teste|exemplo|caso|tempo|espaço|valor|número|nome|lugar|mundo|ano|dia|mês|trabalho|livro|artigo|site|link|botão|menu)\b/gi,
    replace: (match, word) => `um ${word}`,
    description: 'substantivo masculino com artigo indefinido feminino'
  }
];

// Correções adicionais de pontuação e formatação
const additionalFixes = [
  { 
    pattern: /\s+([.,!?;:])/g, 
    replace: '$1', 
    description: 'espaço antes de pontuação' 
  },
  // Comentado: dois pontos consecutivos são um recurso estilístico válido em novels
  // { 
  //   pattern: /([.,!?;:])\s*([.,!?;:])/g, 
  //   replace: '$1$2', 
  //   description: 'pontuação duplicada' 
  // },
  { 
    pattern: /[ ]{2,}/g, 
    replace: ' ', 
    description: 'múltiplos espaços' 
  },
  { 
    pattern: /\n{3,}/g, 
    replace: '\n\n', 
    description: 'quebra de linha excessiva' 
  },
  {
    pattern: /\.\.+/g,
    replace: '...',
    description: 'múltiplos pontos'
  }
];

function readDocx(filePath) {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error(`Arquivo DOCX inválido: ${filePath}`);
  }
  return { zip, xml: entry.getData().toString('utf8') };
}

function applyCorrections(text, verbose = false, correctionsLog = []) {
  let corrected = text;
  let totalChanges = 0;

  // Aplicar correções de gênero
  for (const correction of corrections) {
    let count = 0;
    const newText = corrected.replace(correction.pattern, (match, ...args) => {
      count++;
      const word = args[0];
      const replacement = typeof correction.replace === 'function' 
        ? correction.replace(match, word) 
        : correction.replace;
      
      // Registrar para CSV (apenas primeiras 100 ocorrências para não sobrecarregar)
      if (correctionsLog && correctionsLog.length < 10000) {
        correctionsLog.push({
          before: match.substring(0, 200),
          after: replacement.substring(0, 200),
          type: correction.description,
          pattern: correction.pattern.toString()
        });
      }
      
      return replacement;
    });
    
    if (count > 0) {
      corrected = newText;
      totalChanges += count;
      if (verbose) {
        console.log(`  ✓ ${correction.description}: ${count} ocorrência(s)`);
      }
    }
  }

  // Aplicar correções adicionais
  for (const fix of additionalFixes) {
    let count = 0;
    const newText = corrected.replace(fix.pattern, (match) => {
      count++;
      const replacement = typeof fix.replace === 'function' ? fix.replace(match) : fix.replace;
      if (correctionsLog && correctionsLog.length < 10000 && count <= 5) {
        correctionsLog.push({
          before: match.substring(0, 200),
          after: replacement.substring(0, 200),
          type: fix.description,
          pattern: fix.pattern.toString()
        });
      }
      return replacement;
    });
    if (count > 0) {
      corrected = newText;
      totalChanges += count;
      if (verbose && count > 0) {
        console.log(`  ✓ ${fix.description}: ${count} ocorrência(s)`);
      }
    }
  }

  return { corrected, totalChanges };
}

function processDocxFile(inputPath, outputPath, verbose = false) {
  console.log(`\n📄 Processando: ${path.basename(inputPath)}`);
  
  const { zip, xml } = readDocx(inputPath);
  const $ = cheerio.load(xml, { xmlMode: true });
  
  let totalTextChanges = 0;
  let paragraphCount = 0;
  const correctionsLog = [];
  
  $('w\\:p').each((idx, paragraph) => {
    let paragraphChanged = false;
    
    $(paragraph).find('w\\:t').each((_, textNode) => {
      const original = $(textNode).text();
      if (!original.trim()) return;
      
      const { corrected, totalChanges } = applyCorrections(original, false, correctionsLog);
      
      if (totalChanges > 0) {
        $(textNode).text(corrected);
        totalTextChanges += totalChanges;
        paragraphChanged = true;
      }
    });
    
    if (paragraphChanged) paragraphCount++;
  });
  
  if (totalTextChanges === 0) {
    console.log(`  ℹ️ Nenhuma correção necessária`);
    return false;
  }
  
  // Salvar XML modificado
  const updatedXml = $.xml();
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf8'));
  zip.writeZip(outputPath);
  
  // Salvar CSV de correções
  if (correctionsLog.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const csvPath = path.join(logDir, `correcoes_${timestamp}.csv`);
    const csvHeader = 'Antes,Depois,Tipo,Padrao\n';
    const csvRows = correctionsLog.map(log => 
      `"${log.before.replace(/"/g, '""')}","${log.after.replace(/"/g, '""')}","${log.type}","${log.pattern.replace(/"/g, '""')}"`
    );
    fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'), 'utf8');
    console.log(`  📊 CSV de correções: ${csvPath} (${correctionsLog.length} registros)`);
  }
  
  console.log(`  ✅ Corrigido: ${totalTextChanges} alterações em ${paragraphCount} parágrafos`);
  console.log(`  📁 Salvo: ${outputPath}`);
  
  return true;
}

function processAllDocxFiles(verbose = false) {
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Pasta de entrada não encontrada: ${inputDir}`);
    console.log(`   Certifique-se de que os arquivos DOCX estão em: ${inputDir}`);
    return;
  }
  
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.docx'));
  
  if (files.length === 0) {
    console.log(`ℹ️ Nenhum arquivo .docx encontrado em: ${inputDir}`);
    return;
  }
  
  console.log(`\n🔍 Encontrados ${files.length} arquivo(s) para processar`);
  console.log(`📁 Entrada: ${inputDir}`);
  console.log(`📁 Saída: ${outputDir}`);
  console.log(`📁 Logs: ${logDir}`);
  console.log(`\n${'='.repeat(60)}`);
  
  let processed = 0;
  let totalChangesAll = 0;
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace('.docx', '_fixed.docx'));
    
    try {
      const result = processDocxFile(inputPath, outputPath, verbose);
      if (result) processed++;
    } catch (err) {
      console.error(`  ❌ Erro em ${file}: ${err.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 RESUMO:`);
  console.log(`   Arquivos processados: ${processed}/${files.length}`);
  console.log(`   Arquivos corrigidos: ${processed}`);
  console.log(`   Saída: ${outputDir}`);
  console.log(`   Logs de correções: ${logDir}/correcoes_*.csv`);
  
  if (processed > 0) {
    console.log(`\n✨ Para usar os arquivos corrigidos:`);
    console.log(`   1. Verifique as correções no arquivo CSV`);
    console.log(`   2. Copie os arquivos de ${outputDir} para input/translated/`);
    console.log(`   3. Execute npm run audit:translation para validar`);
  }
}

// Modo verbose via linha de comando
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CORRETOR DE GÊNERO - GOOGLE TRADUTOR              ║
║                                                              ║
║  Corrige problemas comuns de gênero em traduções do         ║
║  Google Tradutor (ex: "o diferente" → "a diferente")        ║
║                                                              ║
║  Gera CSV com todas as correções para revisão manual.       ║
╚══════════════════════════════════════════════════════════════╝
`);

processAllDocxFiles(verbose);