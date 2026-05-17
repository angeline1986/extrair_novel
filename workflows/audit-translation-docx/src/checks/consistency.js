// src/checks/consistency.js
// Verificações de consistência: repetições, padrões suspeitos, coerência interna

import { cleanForComparison, diceCoefficient } from '../utils.js';
import config from '../config.js';

// Verificar repetições excessivas no texto traduzido
export function detectRepetitions(text, options = {}) {
  const { minLength = 20, maxRepeatRatio = config.thresholds.maxRepeatLineRatio } = options;
  const issues = [];
  const warnings = [];
  
  // Dividir em frases/linhas
  const lines = text.split(/[.!?;:\n]+/).filter(l => l.trim().length > minLength);
  const lineCount = lines.length;
  
  if (lineCount === 0) return { issues, warnings };
  
  // Detectar linhas repetidas
  const lineFrequency = new Map();
  for (const line of lines) {
    const normalized = cleanForComparison(line);
    lineFrequency.set(normalized, (lineFrequency.get(normalized) || 0) + 1);
  }
  
  const repeatedLines = [];
  for (const [line, count] of lineFrequency) {
    if (count > 1 && line.length > minLength) {
      repeatedLines.push({ line: line.substring(0, 100), count });
    }
  }
  
  const repeatRatio = repeatedLines.reduce((sum, r) => sum + r.count, 0) / lineCount;
  
  if (repeatRatio > maxRepeatRatio) {
    issues.push({
      type: 'excessive_repetition',
      severity: repeatRatio > 0.15 ? 'FAIL' : 'WARN',
      description: `Repetição excessiva de conteúdo (${(repeatRatio * 100).toFixed(1)}% do texto)`,
      details: {
        repeatRatio: repeatRatio.toFixed(3),
        repeatedExamples: repeatedLines.slice(0, 5).map(r => ({
          text: r.line,
          occurrences: r.count,
        })),
      },
    });
  } else if (repeatedLines.length > 0) {
    warnings.push({
      type: 'minor_repetition',
      severity: 'WARN',
      description: `${repeatedLines.length} frase(s) repetida(s) detectada(s)`,
      details: {
        count: repeatedLines.length,
        examples: repeatedLines.slice(0, 3).map(r => r.line),
      },
    });
  }
  
  return { issues, warnings };
}

// Verificar inconsistências de formatação
export function detectFormattingIssues(text) {
  const issues = [];
  const warnings = [];
  
  // Parênteses não fechados
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    warnings.push({
      type: 'unmatched_parentheses',
      severity: 'WARN',
      description: `Parênteses não balanceados: ${openParens} abertos, ${closeParens} fechados`,
    });
  }
  
  // Aspas não fechadas (simplificado)
  const openQuotes = (text.match(/["'„“«]/g) || []).length;
  const closeQuotes = (text.match(/["'”»]/g) || []).length;
  if (Math.abs(openQuotes - closeQuotes) > 2) {
    warnings.push({
      type: 'unmatched_quotes',
      severity: 'WARN',
      description: `Possível desbalanceamento de aspas: abertas=${openQuotes}, fechadas=${closeQuotes}`,
    });
  }
  
  // Múltiplos espaços consecutivos
  const multipleSpaces = text.match(/[ ]{3,}/g);
  if (multipleSpaces && multipleSpaces.length > 10) {
    warnings.push({
      type: 'multiple_spaces',
      severity: 'WARN',
      description: `Múltiplos espaços consecutivos (${multipleSpaces.length} ocorrências)`,
    });
  }
  
  // Linhas muito longas (possível falta de quebra)
  const lines = text.split('\n');
  const longLines = lines.filter(l => l.length > 200);
  if (longLines.length > 0) {
    warnings.push({
      type: 'very_long_lines',
      severity: 'INFO',
      description: `${longLines.length} linha(s) com mais de 200 caracteres (possível falta de quebra)`,
    });
  }
  
  return { issues, warnings };
}

// Verificar coerência de nomes próprios ao longo do texto
export function detectNameInconsistencies(sourceText, translationText) {
  const issues = [];
  const warnings = [];
  
  // Padrões comuns de nomes próprios (letra maiúscula seguida de minúsculas)
  const namePattern = /[A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?/g;
  
  const sourceNames = new Set((sourceText.match(namePattern) || []));
  const translationNames = new Set((translationText.match(namePattern) || []));
  
  // Nomes que aparecem no original mas têm variações suspeitas na tradução
  for (const sourceName of sourceNames) {
    if (sourceName.length < 3) continue; // Ignorar iniciais ou palavras curtas
    
    let found = false;
    for (const transName of translationNames) {
      // Verificar similaridade (pode ser transliteração)
      const similarity = diceCoefficient(sourceName.toLowerCase(), transName.toLowerCase());
      if (similarity > 0.6) {
        found = true;
        break;
      }
    }
    
    if (!found && sourceName.length > 3) {
      // Pode ser um nome que foi alterado ou removido
      warnings.push({
        type: 'possible_name_alteration',
        severity: 'INFO',
        description: `Nome "${sourceName}" pode ter sido alterado ou removido na tradução`,
        details: { sourceName },
      });
    }
  }
  
  return { issues, warnings };
}

// Verificar se há marcação HTML/XML residual
export function detectResidualMarkup(text) {
  const issues = [];
  const warnings = [];
  
  // Tags HTML/XML
  const htmlTags = text.match(/<\/?[a-z][a-z0-9]*[^<>]*>/gi);
  if (htmlTags && htmlTags.length > 0) {
    issues.push({
      type: 'residual_html',
      severity: 'FAIL',
      description: `${htmlTags.length} tag(s) HTML/XML residual(is) na tradução`,
      details: {
        examples: htmlTags.slice(0, 10),
        count: htmlTags.length,
      },
    });
  }
  
  // Entidades HTML (&nbsp;, &amp;, etc.)
  const htmlEntities = text.match(/&[a-z]+;/gi);
  if (htmlEntities && htmlEntities.length > 5) {
    warnings.push({
      type: 'residual_html_entities',
      severity: 'WARN',
      description: `${htmlEntities.length} entidade(s) HTML residual(is)`,
      details: { examples: [...new Set(htmlEntities.slice(0, 10))] },
    });
  }
  
  return { issues, warnings };
}

// Verificar pontuação estranha (espaços antes/faltando)
export function detectPunctuationIssues(text) {
  const issues = [];
  const warnings = [];
  
  // Espaço antes de pontuação (comum em tradução automática)
  const spaceBeforePunctuation = text.match(/[a-zà-ÿ]\s+[.,!?;:]/gi);
  if (spaceBeforePunctuation && spaceBeforePunctuation.length > 5) {
    warnings.push({
      type: 'space_before_punctuation',
      severity: 'WARN',
      description: `Espaço antes de pontuação (${spaceBeforePunctuation.length} ocorrências)`,
      examples: spaceBeforePunctuation.slice(0, 5),
    });
  }
  
  // Falta de espaço após pontuação
  const noSpaceAfterPunctuation = text.match(/[.!?;:][A-Za-zà-ÿ]/g);
  if (noSpaceAfterPunctuation && noSpaceAfterPunctuation.length > 5) {
    warnings.push({
      type: 'missing_space_after_punctuation',
      severity: 'WARN',
      description: `Falta de espaço após pontuação (${noSpaceAfterPunctuation.length} ocorrências)`,
      examples: noSpaceAfterPunctuation.slice(0, 5),
    });
  }
  
  // Pontuação repetida
// Comentado: dois pontos consecutivos são recurso estilístico em novels
// const repeatedPunctuation = text.match(/[!?]{2,}/g);
// if (repeatedPunctuation && repeatedPunctuation.length > 3) {
//   warnings.push({
//     type: 'repeated_punctuation',
//     severity: 'INFO',
//     description: `Pontuação repetida excessivamente (${repeatedPunctuation.length} ocorrências)`,
//   });
// }
  
  return { issues, warnings };
}

// Função principal que agrupa todas as verificações de consistência
export function runConsistencyChecks(sourceText, translationText) {
  const allIssues = [];
  const allWarnings = [];
  
  // Repetições
  const repetitions = detectRepetitions(translationText);
  allIssues.push(...repetitions.issues);
  allWarnings.push(...repetitions.warnings);
  
  // Formatação
  const formatting = detectFormattingIssues(translationText);
  allIssues.push(...formatting.issues);
  allWarnings.push(...formatting.warnings);
  
  // Nomes próprios
  const names = detectNameInconsistencies(sourceText, translationText);
  allIssues.push(...names.issues);
  allWarnings.push(...names.warnings);
  
  // Markup residual
  const markup = detectResidualMarkup(translationText);
  allIssues.push(...markup.issues);
  allWarnings.push(...markup.warnings);
  
  // Pontuação
  const punctuation = detectPunctuationIssues(translationText);
  allIssues.push(...punctuation.issues);
  allWarnings.push(...punctuation.warnings);
  
  return { issues: allIssues, warnings: allWarnings };
}