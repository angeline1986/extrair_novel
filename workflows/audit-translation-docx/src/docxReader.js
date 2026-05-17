// src/docxReader.js
// Reaproveitado do epub-to-docx, adaptado para ler DOCX existentes

import fs from 'fs';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { normalizeText } from './utils.js';

export function readDocxFile(filePath) {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry('word/document.xml');
  
  if (!entry) {
    throw new Error(`Arquivo DOCX inválido: ${filePath}`);
  }
  
  const xml = entry.getData().toString('utf8');
  const $ = cheerio.load(xml, { xmlMode: true });
  
  // Extrair parágrafos e headings
  const paragraphs = [];
  const headings = [];
  const headingLevels = [];
  
  $('w\\:p').each((_, paragraph) => {
    const text = extractTextFromParagraph($, paragraph);
    if (!text) return;
    
    // Verificar se é heading (estilo de título)
    const style = $(paragraph).find('w\\:pStyle').attr('w:val');
    const isHeading = style && style.match(/^Heading|^Título|^Title/i);
    
    if (isHeading) {
      headings.push(text);
      headingLevels.push(style);
    }
    
    paragraphs.push(text);
  });
  
  // Fallback: se não encontrou headings, tenta por regex
  const fallbackHeadings = paragraphs.filter(p => 
    /^Chapter\s+\d+|^Prologue|^Epilogue|^Interlude/i.test(p)
  );
  
  return {
    filePath,
    paragraphs,
    headings: headings.length > 0 ? headings : fallbackHeadings,
    rawText: paragraphs.join('\n\n'),
    paragraphCount: paragraphs.length,
    headingCount: headings.length,
    charCount: paragraphs.join('').length,
  };
}

function extractTextFromParagraph($, paragraph) {
  const parts = [];
  $(paragraph).find('w\\:t').each((_, textNode) => {
    parts.push($(textNode).text());
  });
  const text = normalizeText(parts.join(''));
  return text;
}

// Ler múltiplos arquivos de uma pasta
export function readAllDocxFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Diretório não encontrado: ${dirPath}`);
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.docx'))
    .sort();
  
  const results = [];
  for (const file of files) {
    try {
      const docx = readDocxFile(`${dirPath}/${file}`);
      results.push({ filename: file, ...docx });
    } catch (err) {
      console.error(`Erro ao ler ${file}: ${err.message}`);
    }
  }
  
  return results;
}