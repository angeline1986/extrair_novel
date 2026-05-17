// src/aligner.js
// Alinha capítulos do original com a tradução

import { extractChapterRange, diceCoefficient, cleanForComparison } from './utils.js';
import { detectChaptersFromParagraphs, parseChapterMeta } from './chapterParser.js';

export function alignChapters(sourceDocs, translatedDocs) {
  const results = [];
  
  // 1. Ordenar ambos por nome (preserva ordem sequencial)
  const sortedSource = [...sourceDocs].sort((a, b) => 
    a.filename.localeCompare(b.filename, undefined, { numeric: true })
  );
  const sortedTranslated = [...translatedDocs].sort((a, b) => 
    a.filename.localeCompare(b.filename, undefined, { numeric: true })
  );
  
  // 2. Criar mapa de traduções por range de capítulos
  const translatedByRange = new Map();
  for (const doc of sortedTranslated) {
    const range = extractChapterRange(doc.filename);
    if (range) {
      translatedByRange.set(`${range.start}-${range.end}`, doc);
    }
  }
  
  // 3. Alinhar cada arquivo fonte com sua tradução
  for (let i = 0; i < sortedSource.length; i++) {
    const source = sortedSource[i];
    const sourceRange = extractChapterRange(source.filename);
    
    // Tradução correspondente (mesmo nome ou mesmo índice)
    let translation = null;
    
    if (sourceRange && translatedByRange.has(`${sourceRange.start}-${sourceRange.end}`)) {
      translation = translatedByRange.get(`${sourceRange.start}-${sourceRange.end}`);
    } else if (i < sortedTranslated.length) {
      // Fallback: usar por posição
      translation = sortedTranslated[i];
    }
    
    if (!translation) {
      results.push({
        source,
        translation: null,
        alignment: 'missing',
        chapters: [],
        issues: ['missing_translation_file'],
        severity: 'FAIL',
      });
      continue;
    }
    
    // 4. Extrair capítulos de cada documento
    const sourceChapters = detectChaptersFromParagraphs(source.paragraphs);
    const translationChapters = detectChaptersFromParagraphs(translation.paragraphs);
    
    // 5. Alinhar capítulos individualmente
    const alignedChapters = alignIndividualChapters(sourceChapters, translationChapters);
    
    // 6. Avaliar alinhamento geral
    const chapterCountDiff = Math.abs(sourceChapters.length - translationChapters.length);
    const severity = determineAlignmentSeverity(sourceChapters, translationChapters, alignedChapters);
    
    results.push({
      source,
      translation,
      alignment: 'matched',
      chapters: alignedChapters,
      stats: {
        sourceChapters: sourceChapters.length,
        translationChapters: translationChapters.length,
        chapterCountDiff,
        matchedChapters: alignedChapters.filter(c => c.matchType !== 'missing').length,
      },
      severity,
      issues: chapterCountDiff > 2 ? ['chapter_count_mismatch'] : [],
    });
  }
  
  return results;
}

// Melhorar a função alignIndividualChapters para usar posição como fallback

function alignIndividualChapters(sourceChapters, translationChapters) {
  const aligned = [];
  const usedTranslated = new Set();
  
  // Primeiro, tentar alinhar por título exato
  for (let i = 0; i < sourceChapters.length; i++) {
    const source = sourceChapters[i];
    let bestMatch = null;
    let bestScore = 0;
    
    for (let j = 0; j < translationChapters.length; j++) {
      if (usedTranslated.has(j)) continue;
      
      const target = translationChapters[j];
      let score = 0;
      
      // Critério 1: Tipo equivalente (prologue ↔ prólogo)
      if (source.meta && target.meta) {
        const typeMatch = 
          (source.meta.type === 'prologue' && target.meta.type === 'prologue') ||
          (source.meta.type === 'epilogue' && target.meta.type === 'epilogue') ||
          (source.meta.type === 'chapter' && target.meta.type === 'chapter');
        
        if (typeMatch) {
          score += 0.5;
        }
        
        // Números de capítulo (se aplicável)
        if (source.meta.number && target.meta.number) {
          const numberMatch = source.meta.number === target.meta.number;
          if (numberMatch) score += 0.3;
        }
      }
      
      // Critério 2: Posição relativa (fallback importante)
      const positionScore = 1 - Math.abs(i - j) / Math.max(sourceChapters.length, 1);
      score += Math.max(0, positionScore) * 0.3;
      
      // Critério 3: Tamanho do conteúdo
      const sourceSize = source.paragraphs.join('').length;
      const targetSize = target.paragraphs.join('').length;
      const sizeRatio = Math.min(sourceSize, targetSize) / Math.max(sourceSize, targetSize);
      score += sizeRatio * 0.2;
      
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = { index: j, target, score };
      }
    }
    
    if (bestMatch) {
      usedTranslated.add(bestMatch.index);
      aligned.push({
        sourceIndex: i,
        sourceTitle: source.title,
        sourceType: source.meta?.type,
        sourceParagraphs: source.paragraphs.length,
        sourceCharCount: source.paragraphs.join('').length,
        translationIndex: bestMatch.index,
        translationTitle: bestMatch.target.title,
        translationType: bestMatch.target.meta?.type,
        translationParagraphs: bestMatch.target.paragraphs.length,
        translationCharCount: bestMatch.target.paragraphs.join('').length,
        matchType: 'matched',
        confidence: bestMatch.score,
      });
    } else {
      // Capítulo sem correspondência
      aligned.push({
        sourceIndex: i,
        sourceTitle: source.title,
        sourceType: source.meta?.type,
        sourceParagraphs: source.paragraphs.length,
        sourceCharCount: source.paragraphs.join('').length,
        matchType: 'missing',
        confidence: 0,
      });
    }
  }
  
  // Capítulos extras na tradução
  for (let j = 0; j < translationChapters.length; j++) {
    if (!usedTranslated.has(j)) {
      const extra = translationChapters[j];
      aligned.push({
        translationIndex: j,
        translationTitle: extra.title,
        translationType: extra.meta?.type,
        translationParagraphs: extra.paragraphs.length,
        translationCharCount: extra.paragraphs.join('').length,
        matchType: 'extra',
        confidence: 0,
      });
    }
  }
  
  return aligned.sort((a, b) => (a.sourceIndex || 999) - (b.sourceIndex || 999));
}

function determineAlignmentSeverity(sourceChapters, translationChapters, aligned) {
  const missingChapters = aligned.filter(a => a.matchType === 'missing').length;
  const extraChapters = aligned.filter(a => a.matchType === 'extra').length;
  
  // Tolerante: permite até 2 capítulos de diferença
  if (missingChapters > 3 || extraChapters > 3) {
    return 'FAIL';
  }
  if (missingChapters > 1 || extraChapters > 1) {
    return 'WARN';
  }
  return 'OK';
}