function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractNumbers(value) {
  return new Set(String(value || '').match(/\d+(?:[.,]\d+)?/g) || []);
}

function extractProperNames(value) {
  const blocked = new Set([
    'The', 'A', 'An', 'And', 'But', 'When', 'Then', 'This', 'That', 'With',
    'He', 'She', 'His', 'Her', 'They', 'It', 'I',
    'O', 'A', 'Os', 'As', 'Um', 'Uma', 'Ele', 'Ela', 'Eles', 'Elas', 'Isso',
    'Então', 'Quando', 'Como', 'Para', 'Com', 'Sem', 'Mas', 'Seção',
  ]);
  const matches = String(value || '').match(/\b[\p{Lu}][\p{L}\p{N}'-]{2,}\b/gu) || [];
  return new Set(matches.filter((item) => !blocked.has(item)));
}

function punctuationProfile(value) {
  const text = String(value || '');
  return {
    hasQuestion: text.includes('?') || text.includes('？'),
    hasExclamation: text.includes('!') || text.includes('！'),
    hasQuote: /["“”‘’]/u.test(text),
  };
}

function overlapCount(leftSet, rightSet) {
  let count = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) count += 1;
  }
  return count;
}

function lengthSimilarity(sourceText, translationText) {
  const sourceLength = compactText(sourceText).length;
  const translationLength = compactText(translationText).length;
  if (!sourceLength || !translationLength) return 0;
  const ratio = translationLength / sourceLength;
  if (ratio < 0.45 || ratio > 2.4) return 0;
  return Math.max(0, 1 - Math.abs(1 - Math.min(ratio, 1 / ratio)));
}

function paragraphScore(sourceText, translationText) {
  const sourceNames = extractProperNames(sourceText);
  const translationNames = extractProperNames(translationText);
  const nameOverlap = overlapCount(sourceNames, translationNames);
  const sourceNumbers = extractNumbers(sourceText);
  const translationNumbers = extractNumbers(translationText);
  const numberOverlap = overlapCount(sourceNumbers, translationNumbers);
  const sourcePunctuation = punctuationProfile(sourceText);
  const translationPunctuation = punctuationProfile(translationText);
  const punctuationMatches = [
    sourcePunctuation.hasQuestion === translationPunctuation.hasQuestion,
    sourcePunctuation.hasExclamation === translationPunctuation.hasExclamation,
    sourcePunctuation.hasQuote === translationPunctuation.hasQuote,
  ].filter(Boolean).length;
  const lengthScore = lengthSimilarity(sourceText, translationText);

  let score = 0;
  const reasons = [];

  if (nameOverlap >= 2) {
    score += 0.45;
    reasons.push('proper_names_strong');
  } else if (nameOverlap === 1) {
    score += 0.28;
    reasons.push('proper_name_match');
  }

  if (numberOverlap > 0 && numberOverlap === Math.min(sourceNumbers.size, translationNumbers.size)) {
    score += 0.2;
    reasons.push('numbers_match');
  }

  if (punctuationMatches >= 2) {
    score += 0.12;
    reasons.push('punctuation_profile_match');
  }

  if (lengthScore >= 0.45) {
    score += 0.18 * lengthScore;
    reasons.push('relative_length_match');
  }

  return {
    score: Math.min(0.99, score),
    reasons,
    nameOverlap,
    numberOverlap,
    lengthScore,
  };
}

function chapterNumberFromSection(section) {
  const value = `${section?.title || ''} ${section?.path || ''}`;
  const patterns = [
    /(?:chapter|cap[ií]tulo)(?:_|\s|-)*0*(\d{1,4})/i,
    /Text\/0*(\d{1,4})(?:_|-)/i,
    /\/0*(\d{1,4})(?:_|-)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function normalizedTitle(section) {
  const title = normalizeText(section?.title);
  return title
    .replace(/^capitulo\s+/, 'chapter ')
    .replace(/^cap\s+/, 'chapter ')
    .replace(/\s+/g, ' ')
    .trim();
}

function indexByChapterNumber(sections) {
  const map = new Map();
  for (const section of sections || []) {
    const number = chapterNumberFromSection(section);
    if (number === null || map.has(number)) continue;
    map.set(number, section);
  }
  return map;
}

function indexByTitle(sections) {
  const map = new Map();
  for (const section of sections || []) {
    const title = normalizedTitle(section);
    if (!title || map.has(title)) continue;
    map.set(title, section);
  }
  return map;
}

function serializeAlignment(translationSection, sourceSection, confidence, reason) {
  return {
    translationIndex: translationSection.index,
    translationTitle: translationSection.title,
    translationPath: translationSection.path,
    sourceIndex: sourceSection?.index ?? null,
    sourceTitle: sourceSection?.title || null,
    sourcePath: sourceSection?.path || null,
    confidence,
    alignmentReason: reason,
  };
}

function findSourceSection(translationSection, sourceByNumber, sourceByTitle, sourceSections) {
  const translationChapterNumber = chapterNumberFromSection(translationSection);
  if (translationChapterNumber !== null && sourceByNumber.has(translationChapterNumber)) {
    return {
      sourceSection: sourceByNumber.get(translationChapterNumber),
      confidence: 0.95,
      reason: 'chapter_number_match',
    };
  }

  const title = normalizedTitle(translationSection);
  if (title && sourceByTitle.has(title)) {
    return {
      sourceSection: sourceByTitle.get(title),
      confidence: 0.9,
      reason: 'normalized_title_match',
    };
  }

  const sourceSection = sourceSections?.[translationSection.index] || null;
  if (sourceSection) {
    return {
      sourceSection,
      confidence: 0.35,
      reason: 'index_fallback_low_confidence',
    };
  }

  return {
    sourceSection: null,
    confidence: 0,
    reason: 'no_alignment_candidate',
  };
}

export function buildChapterAlignment(sourceDoc, translationDoc) {
  const sourceSections = sourceDoc?.sections || [];
  const translationSections = translationDoc?.sections || [];
  const sourceByNumber = indexByChapterNumber(sourceSections);
  const sourceByTitle = indexByTitle(sourceSections);
  const sections = translationSections.map((translationSection) => {
    const result = findSourceSection(translationSection, sourceByNumber, sourceByTitle, sourceSections);
    return serializeAlignment(
      translationSection,
      result.sourceSection,
      result.confidence,
      result.reason
    );
  });

  return {
    schemaVersion: '1.0',
    strategy: 'chapter_number_then_title_then_low_confidence_index',
    reliableThreshold: 0.8,
    stats: {
      translationSections: translationSections.length,
      sourceSections: sourceSections.length,
      reliableMatches: sections.filter((item) => item.confidence >= 0.8).length,
      lowConfidenceMatches: sections.filter((item) => item.confidence > 0 && item.confidence < 0.8).length,
      unmatched: sections.filter((item) => item.confidence === 0).length,
    },
    sections,
  };
}

export function findAlignmentForTranslationPath(chapterAlignment, translationPath) {
  return (chapterAlignment?.sections || []).find((item) => item.translationPath === translationPath) || null;
}

export function alignedOriginalParagraph({ sourceDoc, chapterAlignment, translationPath, paragraphIndex }) {
  return alignedOriginalParagraphByText({
    sourceDoc,
    chapterAlignment,
    translationPath,
    paragraphIndex,
    translatedParagraph: null,
  });
}

export function alignedOriginalParagraphByText({
  sourceDoc,
  chapterAlignment,
  translationPath,
  paragraphIndex,
  translatedParagraph,
}) {
  const alignment = findAlignmentForTranslationPath(chapterAlignment, translationPath);
  if (!alignment) {
    return {
      text: null,
      confidence: 0,
      reason: 'no_alignment_candidate',
      paragraphAlignmentConfidence: 0,
      paragraphAlignmentReason: 'no_chapter_alignment',
    };
  }

  if (alignment.confidence < (chapterAlignment?.reliableThreshold || 0.8)) {
    return {
      text: null,
      confidence: alignment.confidence,
      reason: alignment.alignmentReason,
      paragraphAlignmentConfidence: 0,
      paragraphAlignmentReason: 'chapter_alignment_below_threshold',
    };
  }

  const sourceSection = (sourceDoc?.sections || []).find((section) => section.index === alignment.sourceIndex);
  if (!sourceSection) {
    return {
      text: null,
      confidence: alignment.confidence,
      reason: alignment.alignmentReason,
      paragraphAlignmentConfidence: 0,
      paragraphAlignmentReason: 'source_section_not_found',
    };
  }

  if (!translatedParagraph) {
    return {
      text: null,
      confidence: alignment.confidence,
      reason: alignment.alignmentReason,
      paragraphAlignmentConfidence: 0.3,
      paragraphAlignmentReason: 'paragraph_index_fallback_low_confidence',
    };
  }

  const candidates = (sourceSection.paragraphs || [])
    .map((paragraph, index) => ({
      index,
      paragraph,
      ...paragraphScore(paragraph, translatedParagraph),
    }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] || null;
  const second = candidates[1] || null;
  const margin = best && second ? best.score - second.score : best?.score || 0;
  const safe = Boolean(best && best.score >= 0.72 && margin >= 0.12);

  return {
    text: safe ? best.paragraph : null,
    confidence: alignment.confidence,
    reason: alignment.alignmentReason,
    paragraphAlignmentConfidence: best?.score || 0,
    paragraphAlignmentReason: safe
      ? `safe_paragraph_match:${best.reasons.join('+') || 'heuristic'}`
      : `ambiguous_or_low_confidence_paragraph_match:${best?.reasons.join('+') || 'no_signal'}`,
    paragraphAlignmentIndex: safe ? best.index : null,
    paragraphIndexFallback: paragraphIndex,
  };
}
