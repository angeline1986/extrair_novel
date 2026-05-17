// src/utils.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Normalização de texto
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

// Limpeza para comparação
export function cleanForComparison(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove pontuação
    .replace(/\s+/g, ' ');
}

// Hash rápido do texto
export function quickHash(text) {
  return crypto.createHash('md5').update(normalizeText(text)).digest('hex').substring(0, 8);
}

// Coeficiente de Dice (similaridade de conjuntos)
export function diceCoefficient(str1, str2) {
  const s1 = cleanForComparison(str1);
  const s2 = cleanForComparison(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);
  
  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) intersection++;
  }
  
  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

// Ordenação natural de strings (ex: cap_01-06, cap_07-12)
export function naturalCompare(a, b) {
  const regex = /(\d+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const numA = parseInt(aParts[i], 10);
    const numB = parseInt(bParts[i], 10);
    if (numA !== numB) return numA - numB;
  }
  return a.localeCompare(b);
}

// Extrair range de capítulos do nome do arquivo
// "Eighteens_Bed_cap_13-17.docx" → { start: 13, end: 17 }
export function extractChapterRange(filename) {
  const match = filename.match(/cap_(\d+)-(\d+)\.docx$/i);
  if (match) {
    return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
  }
  return null;
}

// Log com timestamp
export function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// Delay para rate limiting
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}