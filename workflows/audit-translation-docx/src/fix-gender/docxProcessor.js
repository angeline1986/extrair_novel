// src/fix-gender/docxProcessor.js
// Leitura e escrita de DOCX

import fs from 'fs';
import path from 'path';  // <-- ADICIONAR ESTA LINHA
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { applyCorrections } from './textProcessor.js';

export function readDocx(filePath) {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error(`Arquivo DOCX inválido: ${filePath}`);
  }
  return { zip, xml: entry.getData().toString('utf8') };
}

export function writeDocx(zip, outputPath) {
  zip.writeZip(outputPath);
}

export function processDocxFile(inputPath, outputPath, verbose = false, correctionsLog = []) {
  console.log(`\n📄 Processando: ${path.basename(inputPath)}`);
  
  const { zip, xml } = readDocx(inputPath);
  const $ = cheerio.load(xml, { xmlMode: true });
  
  let totalTextChanges = 0;
  let paragraphCount = 0;
  
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
  
  const updatedXml = $.xml();
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf8'));
  writeDocx(zip, outputPath);
  
  console.log(`  ✅ Corrigido: ${totalTextChanges} alterações em ${paragraphCount} parágrafos`);
  console.log(`  📁 Salvo: ${outputPath}`);
  
  return true;
}