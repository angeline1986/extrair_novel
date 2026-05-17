// src/checks/content.js
// Verificações de conteúdo: tamanho, parágrafos, truncamento, inglês residual

import { cleanForComparison, diceCoefficient } from '../utils.js';
import config from '../config.js';

// Verificar se o texto foi truncado (termina de forma abrupta)
export function detectTruncation(text) {
  const issues = [];
  const warnings = [];
  
  const lastChars = text.slice(-50).trim();
  
  // Padrões de truncamento comum
  const truncationPatterns = [
    { pattern: /\.\.\.$/, description: "termina com '...' (possível truncamento)" },
    { pattern: /[a-z]$/i, description: "termina com letra minúscula sem pontuação" },
    { pattern: /,\s*$/, description: "termina com vírgula (frase incompleta)" },
    { pattern: /[aeiou]$/i, description: "termina com vogal sem pontuação" },
  ];
  
  for (const { pattern, description } of truncationPatterns) {
    if (pattern.test(lastChars)) {
      warnings.push({
        type: 'possible_truncation',
        severity: 'WARN',
        description,
        details: { endOfText: lastChars },
      });
      break;
    }
  }
  
  // Verificar se última linha é muito curta (possível corte)
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const lastLine = lines[lines.length - 1] || '';
  
  if (lastLine.length > 0 && lastLine.length < 30 && lines.length > 3) {
    warnings.push({
      type: 'very_short_last_line',
      severity: 'INFO',
      description: `Última linha muito curta (${lastLine.length} caracteres) - possível corte`,
      details: { lastLine: lastLine.substring(0, 100) },
    });
  }
  
  return { issues, warnings };
}

// Verificar quantidade de inglês residual
export function detectResidualEnglish(text) {
  const issues = [];
  const warnings = [];
  
  // Lista de palavras inglesas comuns (excluindo cognatos válidos em português)
  const commonEnglishWords = new Set([
    'the', 'and', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at',
    'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'but', 'or', 'so', 'for', 'nor', 'yet', 'so', 'however',
    'this', 'that', 'these', 'those', 'a', 'an', 'then', 'than',
    'will', 'would', 'could', 'should', 'might', 'must',
    'there', 'their', 'they', 'them', 'we', 'our', 'us',
  ]);
  
  // Palavras que são válidas em português (cognatos ou palavras comuns)
  const validPortuguese = new Set([
    'de', 'do', 'da', 'dos', 'das', 'em', 'com', 'para', 'por', 'sem',
    'sob', 'sobre', 'após', 'antes', 'entre', 'durante', 'até', 'como',
    'mais', 'menos', 'muito', 'pouco', 'todo', 'toda', 'todos', 'todas',
    'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas',
    'aquele', 'aquela', 'aqueles', 'aquelas', 'seu', 'sua', 'seus', 'suas',
    'meu', 'minha', 'meus', 'minhas', 'nosso', 'nossa', 'nossos', 'nossas',
    'que', 'qual', 'quais', 'quem', 'cujo', 'cuja', 'onde', 'aonde',
    'quando', 'como', 'quanto', 'porque', 'pois', 'então', 'assim',
    'também', 'contra', 'através', 'acima', 'abaixo', 'dentro', 'fora',
  ]);
  
  const words = text.toLowerCase().split(/\s+/);
  let englishCount = 0;
  const englishExamples = new Set();
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length < 3) continue;
    if (validPortuguese.has(cleanWord)) continue;
    
    if (commonEnglishWords.has(cleanWord)) {
      englishCount++;
      if (englishExamples.size < 10) {
        englishExamples.add(cleanWord);
      }
    }
  }
  
  const englishRatio = englishCount / words.length;
  const maxRatio = config.thresholds.maxEnglishWordsRatio;
  
  if (englishRatio > maxRatio) {
    issues.push({
      type: 'residual_english',
      severity: englishRatio > 0.15 ? 'FAIL' : 'WARN',
      description: `${(englishRatio * 100).toFixed(1)}% do texto contém palavras em inglês`,
      details: {
        ratio: englishRatio.toFixed(3),
        examples: Array.from(englishExamples),
        count: englishCount,
        totalWords: words.length,
      },
    });
  } else if (englishExamples.size > 0) {
    warnings.push({
      type: 'minor_english',
      severity: 'INFO',
      description: `${englishExamples.size} palavra(s) em inglês detectada(s)`,
      details: { examples: Array.from(englishExamples) },
    });
  }
  
  return { issues, warnings };
}

// Verificar proporção de conteúdo (tamanho)
export function detectSizeIssues(source, translation, options = {}) {
  const { minRatio = config.thresholds.minSizeRatio, maxRatio = config.thresholds.maxSizeRatio } = options;
  const issues = [];
  
  const sourceSize = source.charCount || source.length;
  const translationSize = translation.charCount || translation.length;
  const ratio = translationSize / Math.max(sourceSize, 1);
  
  if (ratio < minRatio) {
    issues.push({
      type: 'translation_too_short',
      severity: ratio < 0.4 ? 'FAIL' : 'WARN',
      description: `Tradução muito menor que o original (${(ratio * 100).toFixed(0)}%)`,
      details: {
        sourceSize,
        translationSize,
        ratio: ratio.toFixed(3),
        difference: sourceSize - translationSize,
      },
    });
  } else if (ratio > maxRatio) {
    issues.push({
      type: 'translation_too_long',
      severity: 'WARN',
      description: `Tradução muito maior que o original (${(ratio * 100).toFixed(0)}%)`,
      details: {
        sourceSize,
        translationSize,
        ratio: ratio.toFixed(3),
        difference: translationSize - sourceSize,
      },
    });
  }
  
  return { issues };
}

// Verificar diferença na quantidade de parágrafos
export function detectParagraphIssues(sourceParagraphs, translationParagraphs, options = {}) {
  const { minRatio = config.thresholds.minParagraphRatio, maxRatio = config.thresholds.maxParagraphRatio } = options;
  const issues = [];
  const warnings = [];
  
  const sourceCount = sourceParagraphs.length;
  const translationCount = translationParagraphs.length;
  const ratio = translationCount / Math.max(sourceCount, 1);
  
  if (ratio < minRatio) {
    issues.push({
      type: 'paragraph_count_too_low',
      severity: 'WARN',
      description: `Número de parágrafos muito menor: ${translationCount} vs ${sourceCount} original (${(ratio * 100).toFixed(0)}%)`,
      details: { sourceCount, translationCount, ratio: ratio.toFixed(3) },
    });
  } else if (ratio > maxRatio) {
    warnings.push({
      type: 'paragraph_count_high',
      severity: 'INFO',
      description: `Número de parágrafos maior: ${translationCount} vs ${sourceCount} original (${(ratio * 100).toFixed(0)}%)`,
      details: { sourceCount, translationCount, ratio: ratio.toFixed(3) },
    });
  }
  
  return { issues, warnings };
}

// Verificar primeiro e último parágrafo (conteúdo importante)
export function detectBoundaryIssues(sourceFirst, translationFirst, sourceLast, translationLast) {
  const issues = [];
  const warnings = [];
  
  // Verificar primeiro parágrafo
  if (sourceFirst && translationFirst) {
    const similarity = diceCoefficient(sourceFirst, translationFirst);
    if (similarity < 0.3 && sourceFirst.length > 30 && translationFirst.length > 30) {
      warnings.push({
        type: 'first_paragraph_mismatch',
        severity: 'WARN',
        description: 'Primeiro parágrafo parece muito diferente do original',
        details: {
          sourcePreview: sourceFirst.substring(0, 150),
          translationPreview: translationFirst.substring(0, 150),
          similarity: similarity.toFixed(2),
        },
      });
    }
  }
  
  // Verificar último parágrafo
  if (sourceLast && translationLast) {
    const similarity = diceCoefficient(sourceLast, translationLast);
    if (similarity < 0.3 && sourceLast.length > 30 && translationLast.length > 30) {
      warnings.push({
        type: 'last_paragraph_mismatch',
        severity: 'WARN',
        description: 'Último parágrafo parece muito diferente do original',
        details: {
          sourcePreview: sourceLast.substring(0, 150),
          translationPreview: translationLast.substring(0, 150),
          similarity: similarity.toFixed(2),
        },
      });
    }
  }
  
  return { issues, warnings };
}

// Verificar se há conteúdo vazio ou muito curto
export function detectEmptyOrVeryShortContent(source, translation) {
  const issues = [];
  
  const sourceText = source.rawText || source;
  const translationText = translation.rawText || translation;
  
  if (sourceText.length > 500 && translationText.length < 100) {
    issues.push({
      type: 'empty_translation',
      severity: 'FAIL',
      description: 'Tradução praticamente vazia para um conteúdo original substancial',
      details: {
        sourceSize: sourceText.length,
        translationSize: translationText.length,
        ratio: (translationText.length / sourceText.length).toFixed(3),
      },
    });
  } else if (sourceText.length > 100 && translationText.length < 20) {
    issues.push({
      type: 'very_short_translation',
      severity: 'FAIL',
      description: 'Tradução extremamente curta',
      details: {
        sourceSize: sourceText.length,
        translationSize: translationText.length,
      },
    });
  }
  
  return { issues };
}

// Função principal que agrupa todas as verificações de conteúdo
export function runContentChecks(source, translation) {
  const allIssues = [];
  const allWarnings = [];
  
  // Truncamento
  const truncation = detectTruncation(translation.rawText);
  allIssues.push(...truncation.issues);
  allWarnings.push(...truncation.warnings);
  
  // Inglês residual
  const english = detectResidualEnglish(translation.rawText);
  allIssues.push(...english.issues);
  allWarnings.push(...english.warnings);
  
  // Tamanho
  const size = detectSizeIssues(source, translation);
  allIssues.push(...size.issues);
  
  // Parágrafos
  const paragraphs = detectParagraphIssues(source.paragraphs, translation.paragraphs);
  allIssues.push(...paragraphs.issues);
  allWarnings.push(...paragraphs.warnings);
  
  // Primeiro/último parágrafo
  const boundaries = detectBoundaryIssues(
    source.paragraphs[0],
    translation.paragraphs[0],
    source.paragraphs[source.paragraphs.length - 1],
    translation.paragraphs[translation.paragraphs.length - 1]
  );
  allIssues.push(...boundaries.issues);
  allWarnings.push(...boundaries.warnings);
  
  // Vazio/curto demais
  const empty = detectEmptyOrVeryShortContent(source, translation);
  allIssues.push(...empty.issues);
  
  return { issues: allIssues, warnings: allWarnings };
}