import { getLanguageConfig } from './languageConfig.js';

function collectExamples(text, regex, limit = 5) {
  const examples = [];
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let match;

  while ((match = globalRegex.exec(text)) && examples.length < limit) {
    const index = match.index || 0;
    const start = Math.max(0, index - 90);
    const end = Math.min(text.length, index + match[0].length + 90);

    examples.push({
      match: match[0],
      context: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      index,
    });

    if (match[0].length === 0) globalRegex.lastIndex += 1;
  }

  return examples;
}

function sectionTitle(section) {
  return section.sourceTitle || `Secao ${section.sourceIndex + 1}`;
}

export function runEpubStructuralChecks(sourceDoc, translationDoc, alignment) {
  const issues = [];
  const warnings = [];

  const missingSections = alignment.filter((item) => item.matchType === 'missing');
  if (missingSections.length > 0) {
    issues.push({
      type: 'missing_sections',
      severity: 'FAIL',
      description: 'Secoes textuais do EPUB original nao encontradas na traducao.',
      details: missingSections.map((item) => ({
        index: item.sourceIndex,
        title: sectionTitle(item),
        sourceParagraphs: item.sourceParagraphs,
        sourceChars: item.sourceCharCount,
      })),
    });
  }

  const extraSections = alignment.filter((item) => item.matchType === 'extra');
  if (extraSections.length > 0) {
    warnings.push({
      type: 'extra_sections',
      severity: 'WARN',
      description: 'A traducao tem secoes textuais extras em relacao ao original.',
      details: extraSections.map((item) => ({
        index: item.translationIndex,
        title: item.translationTitle || `Secao ${item.translationIndex + 1}`,
        translationParagraphs: item.translationParagraphs,
        translationChars: item.translationCharCount,
      })),
    });
  }

  for (const section of alignment.filter((item) => item.matchType === 'matched')) {
    if (section.sourceCharCount < 800) continue;

    const sizeRatio = section.translationCharCount / Math.max(section.sourceCharCount, 1);
    const paragraphRatio = section.translationParagraphs / Math.max(section.sourceParagraphs, 1);

    if (sizeRatio < 0.35) {
      issues.push({
        type: 'epub_section_too_short',
        severity: 'FAIL',
        description: 'Secao traduzida muito menor que a secao original.',
        details: {
          sourceIndex: section.sourceIndex,
          sourceTitle: sectionTitle(section),
          translationIndex: section.translationIndex,
          translationTitle: section.translationTitle,
          ratio: Number(sizeRatio.toFixed(3)),
          sourceChars: section.sourceCharCount,
          translationChars: section.translationCharCount,
        },
      });
    } else if (sizeRatio < 0.55) {
      warnings.push({
        type: 'epub_section_short',
        severity: 'WARN',
        description: 'Secao traduzida menor que o esperado.',
        details: {
          sourceIndex: section.sourceIndex,
          sourceTitle: sectionTitle(section),
          ratio: Number(sizeRatio.toFixed(3)),
        },
      });
    }

    if (paragraphRatio < 0.35 && section.sourceParagraphs >= 10) {
      warnings.push({
        type: 'epub_paragraph_count_low',
        severity: 'WARN',
        description: 'Quantidade de paragrafos traduzidos muito menor que no original.',
        details: {
          sourceIndex: section.sourceIndex,
          sourceTitle: sectionTitle(section),
          sourceParagraphs: section.sourceParagraphs,
          translationParagraphs: section.translationParagraphs,
          ratio: Number(paragraphRatio.toFixed(3)),
        },
      });
    }
  }

  const sourceTextSections = sourceDoc.sections.filter((section) => section.charCount > 0).length;
  const translatedTextSections = translationDoc.sections.filter((section) => section.charCount > 0).length;
  const sectionRatio = translatedTextSections / Math.max(sourceTextSections, 1);

  if (sectionRatio < 0.9 || sectionRatio > 1.12) {
    warnings.push({
      type: 'epub_text_section_count_mismatch',
      severity: 'WARN',
      description: 'Quantidade de secoes textuais difere entre original e traducao.',
      details: {
        sourceTextSections,
        translatedTextSections,
        ratio: Number(sectionRatio.toFixed(3)),
      },
    });
  }

  return { issues, warnings };
}

export function runEpubContentChecks(sourceDoc, translationDoc, sourceLang = 'en') {
  const issues = [];
  const warnings = [];
  const sourceChars = sourceDoc.charCount;
  const translationChars = translationDoc.charCount;
  const sizeRatio = translationChars / Math.max(sourceChars, 1);

  if (sizeRatio < 0.55) {
    issues.push({
      type: 'epub_translation_too_short',
      severity: 'FAIL',
      description: 'EPUB traduzido muito menor que o original.',
      details: { sourceChars, translationChars, ratio: Number(sizeRatio.toFixed(3)) },
    });
  } else if (sizeRatio > 1.65) {
    warnings.push({
      type: 'epub_translation_too_long',
      severity: 'WARN',
      description: 'EPUB traduzido muito maior que o original.',
      details: { sourceChars, translationChars, ratio: Number(sizeRatio.toFixed(3)) },
    });
  }

  warnings.push(...detectResidualSourceLanguageBlocks(translationDoc.rawText, sourceLang));
  return { issues, warnings };
}

export function runEpubLanguageChecks(text) {
  const issues = [];
  const warnings = [];
  const genderPatterns = [
    {
      pattern: /(?<![\p{L}\p{N}])o\s+(relativamente|friamente|atentamente|profundamente|cuidadosamente|rapidamente|lentamente)\b/giu,
      description: 'possivel concordancia estranha antes de adverbio terminado em -mente',
    },
    {
      pattern: /(?<![\p{L}\p{N}])a\s+(programa|sistema|problema|mundo|tempo|lugar|nome|arquivo|capitulo|capítulo)\b/giu,
      description: 'possivel artigo feminino antes de substantivo masculino',
    },
  ];

  for (const item of genderPatterns) {
    const matches = [...text.matchAll(item.pattern)];
    if (matches.length >= 8) {
      warnings.push({
        type: 'epub_gender_suspicion',
        severity: 'WARN',
        description: item.description,
        occurrences: matches.length,
        examples: collectExamples(text, item.pattern),
      });
    }
  }

  const brokenSentenceRegex = /\.\s+[a-záéíóúâêôãõç]/giu;
  const examples = collectExamples(text, brokenSentenceRegex);
  const usefulExamples = examples.filter((example) => !/https?:\/\//i.test(example.context));
  const matches = [...text.matchAll(brokenSentenceRegex)];

  if (matches.length > 120 && usefulExamples.length > 0) {
    warnings.push({
      type: 'epub_possible_broken_sentence',
      severity: 'WARN',
      description: 'Muitos pontos seguidos de minuscula; pode indicar quebra ruim, mas URLs/notas podem gerar ruido.',
      occurrences: matches.length,
      examples: usefulExamples,
    });
  }

  return { issues, warnings };
}

export function detectResidualSourceLanguageBlocks(text, sourceLang = 'en') {
  const config = getLanguageConfig(sourceLang);
  const paragraphs = String(text || '').split(/\n{2,}/);
  const sourcePattern = new RegExp(`\\b(${config.residualMarkers.join('|')})\\b`, 'gi');
  const portugueseMarkers = /\b(que|com|para|uma|não|nao|ele|ela|dos|das|por|como|mais|muito|quando)\b/giu;
  const examples = [];

  for (const paragraph of paragraphs) {
    const compact = paragraph.replace(/\s+/g, ' ').trim();
    if (compact.length < 120) continue;

    const sourceHits = [...compact.matchAll(sourcePattern)].length;
    // Para espanhol, relaxar a verificação de marcadores portugueses pois há muitas palavras comuns
    const hasPortugueseMarkers = sourceLang === 'es' 
      ? portugueseMarkers.test(compact) && [...compact.matchAll(portugueseMarkers)].length > sourceHits
      : portugueseMarkers.test(compact);
    
    if (sourceHits >= config.residualThreshold && !hasPortugueseMarkers) {
      examples.push({
        match: `${config.name.toLowerCase()} paragraph`,
        context: compact.slice(0, 240),
        index: text.indexOf(paragraph),
      });
    }

    if (examples.length >= 5) break;
  }

  return examples.length > 0
    ? [{
        type: `epub_residual_${sourceLang}_block`,
        severity: 'WARN',
        description: `Possiveis blocos longos em ${config.name.toLowerCase()} permaneceram na traducao.`,
        occurrences: examples.length,
        examples,
      }]
    : [];
}
