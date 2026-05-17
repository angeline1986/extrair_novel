// src/checks/structural.js
// Verificações estruturais (capítulos faltando, tamanho, parágrafos)

export function runStructuralChecks(source, translation, alignment) {
  const issues = [];
  const warnings = [];
  
  // 1. Verificar capítulos faltando
  const missingChapters = alignment.filter(a => a.matchType === 'missing');
  if (missingChapters.length > 0) {
    issues.push({
      type: 'missing_chapters',
      severity: 'FAIL',
      details: missingChapters.map(c => ({
        index: c.sourceIndex,
        title: c.sourceTitle || `Capítulo ${c.sourceIndex + 1}`,
        sourceParagraphs: c.sourceParagraphs,
        sourceChars: c.sourceCharCount,
      })),
    });
  }
  
  // 2. Verificar capítulos extras
  const extraChapters = alignment.filter(a => a.matchType === 'extra');
  if (extraChapters.length > 0) {
    warnings.push({
      type: 'extra_chapters',
      severity: 'WARN',
      details: extraChapters.map(c => ({
        title: c.translationTitle || `Extra ${c.translationIndex + 1}`,
        paragraphs: c.translationParagraphs,
        chars: c.translationCharCount,
      })),
    });
  }
  
  // 3. Verificar proporção de tamanho por capítulo (tolerante)
  const matchedChapters = alignment.filter(a => a.matchType === 'matched');
  for (const chapter of matchedChapters) {
    const sizeRatio = chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
    
    if (sizeRatio < 0.4) {
      issues.push({
        type: 'size_ratio_too_low',
        severity: 'FAIL',
        details: {
          sourceIndex: chapter.sourceIndex,
          sourceTitle: chapter.sourceTitle,
          ratio: sizeRatio,
          sourceChars: chapter.sourceCharCount,
          translationChars: chapter.translationCharCount,
        },
      });
    } else if (sizeRatio < 0.65) {
      warnings.push({
        type: 'size_ratio_low',
        severity: 'WARN',
        details: {
          sourceIndex: chapter.sourceIndex,
          sourceTitle: chapter.sourceTitle,
          ratio: sizeRatio,
        },
      });
    }
    
    // Verificar diferença de parágrafos
    const paraRatio = chapter.translationParagraphs / Math.max(chapter.sourceParagraphs, 1);
    if (paraRatio < 0.5) {
      warnings.push({
        type: 'paragraph_count_low',
        severity: 'WARN',
        details: {
          sourceIndex: chapter.sourceIndex,
          sourceTitle: chapter.sourceTitle,
          sourceParagraphs: chapter.sourceParagraphs,
          translationParagraphs: chapter.translationParagraphs,
        },
      });
    }
  }
  
  // 4. Verificar conteúdo vazio
  if (translation.rawText.length < 100 && source.rawText.length > 500) {
    issues.push({
      type: 'empty_translation',
      severity: 'FAIL',
      details: {
        sourceChars: source.charCount,
        translationChars: translation.charCount,
      },
    });
  }
  
  return {
    issues,
    warnings,
    score: calculateStructuralScore(matchedChapters, missingChapters.length),
  };
}

function calculateStructuralScore(matchedChapters, missingCount) {
  if (matchedChapters.length === 0) return 0;
  
  let score = 1.0;
  
  // Penalidade por capítulos faltando
  score -= missingCount * 0.15;
  
  // Penalidade por tamanho muito diferente
  for (const chapter of matchedChapters) {
    const sizeRatio = chapter.translationCharCount / Math.max(chapter.sourceCharCount, 1);
    if (sizeRatio < 0.5) score -= 0.1;
    else if (sizeRatio < 0.7) score -= 0.05;
  }
  
  return Math.max(0, Math.min(1, score));
}