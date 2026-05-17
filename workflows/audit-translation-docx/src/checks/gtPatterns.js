// src/checks/gtPatterns.js
// Padrões específicos do Google Tradutor

import config from '../config.js';

export function detectGoogleTranslateIssues(text, originalText = null) {
  const issues = [];
  const warnings = [];
  
  const patterns = config.gtPatterns;
  
  // 1. Problemas de gênero
  for (const pattern of patterns.genderIssues) {
    const matches = text.match(new RegExp(pattern.pattern, 'gi'));
    if (matches && matches.length > 3) { // Mínimo 3 ocorrências para reportar
      issues.push({
        type: 'gender_issue',
        pattern: pattern.pattern,
        description: pattern.description,
        occurrences: matches.length,
        severity: matches.length > 10 ? 'FAIL' : 'WARN',
      });
    }
  }
  
  // 2. Frases quebradas
  for (const pattern of patterns.brokenSentences) {
    const matches = text.match(pattern.pattern);
    if (matches && matches.length > 5) {
      warnings.push({
        type: 'broken_sentence',
        pattern: pattern.pattern,
        description: pattern.description,
        occurrences: matches.length,
        severity: 'WARN',
      });
    }
  }
  
  // 3. Nomes próprios alterados
  for (const pattern of patterns.nameCorruption) {
    const matches = text.match(pattern.pattern);
    if (matches && matches.length > 0) {
      warnings.push({
        type: 'name_corruption',
        pattern: pattern.pattern,
        description: pattern.description,
        occurrences: matches.length,
        severity: matches.length > 5 ? 'FAIL' : 'WARN',
      });
    }
  }
  
  // 4. Marcas de tradução automática
  for (const pattern of patterns.autoTranslateMarks) {
    if (pattern.pattern.test(text)) {
      warnings.push({
        type: 'auto_translate_mark',
        description: pattern.description,
        severity: 'WARN',
      });
    }
  }
  
  // 5. Detectar pontuação estranha (espaços antes de pontuação)
  const weirdSpacing = text.match(/[a-z]\s+[.,!?;]/gi);
  if (weirdSpacing && weirdSpacing.length > 10) {
    warnings.push({
      type: 'weird_spacing',
      description: 'Espaço antes de pontuação',
      occurrences: weirdSpacing.length,
      severity: 'WARN',
    });
  }
  
  // 6. Palavras em inglês mantidas (comum no GT)
  const englishWords = detectEnglishWords(text);
  if (englishWords.length > 0) {
    const ratio = englishWords.length / text.split(/\s+/).length;
    if (ratio > 0.05) {
      issues.push({
        type: 'english_words_retained',
        description: 'Palavras em inglês mantidas na tradução',
        examples: englishWords.slice(0, 10),
        count: englishWords.length,
        ratio: ratio.toFixed(3),
        severity: ratio > 0.1 ? 'FAIL' : 'WARN',
      });
    }
  }
  
  return { issues, warnings };
}

function detectEnglishWords(text) {
  const commonEnglishWords = new Set([
    'the', 'and', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at',
    'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'but', 'or', 'so', 'for', 'nor', 'yet', 'so',
    'this', 'that', 'these', 'those', 'a', 'an',
  ]);
  
  const words = text.toLowerCase().split(/\s+/);
  const found = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length > 2 && commonEnglishWords.has(cleanWord)) {
      found.push(cleanWord);
    }
  }
  
  return [...new Set(found)];
}