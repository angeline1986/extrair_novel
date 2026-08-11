import {
  alignedOriginalParagraphByText,
} from './chapterAligner.js';
import {
  normalizeEntityAliasEntries,
} from './correction/entityNormalizer.js';
import {
  normalizeTermEntries,
} from './correction/terminologyNormalizer.js';

const MAX_TOTAL_CANDIDATES = 120;
const MAX_PER_TYPE = 30;

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function preview(value, limit = 260) {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function normalize(value) {
  return compact(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function wordTokens(value) {
  return normalize(value).match(/[\p{L}\p{N}]{3,}/gu) || [];
}

function lengthRatio(original, translation) {
  const originalLength = compact(original).length;
  const translationLength = compact(translation).length;
  if (!originalLength || !translationLength) return 1;
  return translationLength / originalLength;
}

function extractNumbers(value) {
  return [...new Set(String(value || '').match(/\d+(?:[.,]\d+)?/g) || [])];
}

function semanticallyRelevantNumbers(value) {
  return extractNumbers(value).map((number) => number.replace(/[,.](?=\d{3}\b)/gu, '')).filter((number) => {
    if (/^\d$/u.test(number)) return false;
    return true;
  });
}

function extractProperNames(value) {
  const blocked = new Set([
    'The', 'And', 'But', 'When', 'Then', 'This', 'That', 'With', 'His', 'Her',
    'Ele', 'Ela', 'Eles', 'Elas', 'Para', 'Com', 'Sem', 'Mas', 'Quando',
  ]);
  return [...new Set(String(value || '').match(/\b[\p{Lu}][\p{L}\p{N}'-]{2,}\b/gu) || [])]
    .filter((item) => !blocked.has(item));
}

function punctuationProfile(value) {
  const text = String(value || '');
  return {
    question: text.includes('?') || text.includes('？'),
    exclamation: text.includes('!') || text.includes('！'),
    quote: /["“”‘’]/u.test(text),
  };
}

function missingItems(sourceItems, translatedText) {
  const normalizedTranslated = normalize(translatedText);
  return sourceItems.filter((item) => !normalizedTranslated.includes(normalize(item)));
}

function severityForRatio(ratio) {
  if (ratio < 0.42 || ratio > 2.7) return 'high';
  if (ratio < 0.58 || ratio > 2.1) return 'medium';
  return 'low';
}

function semanticId(index) {
  return `sem-${String(index + 1).padStart(4, '0')}`;
}

function locationFromParagraph(paragraph) {
  const firstNode = paragraph.textNodes?.[0] || {};
  return {
    filePath: paragraph.filePath,
    spineIndex: paragraph.spineIndex,
    paragraphIndex: paragraph.paragraphIndex,
    textNodeIndex: firstNode.textNodeIndex ?? 0,
    nodeId: firstNode.id || null,
    textPreview: paragraph.textPreview,
  };
}

function contextForParagraph(paragraphs, index) {
  return {
    previousParagraph: preview(paragraphs[index - 1]?.text || null),
    currentParagraph: preview(paragraphs[index]?.text || null),
    nextParagraph: preview(paragraphs[index + 1]?.text || null),
  };
}

function candidateBase({
  candidates,
  paragraph,
  paragraphs,
  index,
  alignment,
  type,
  severity,
  confidence = 'heuristic',
  confidenceScore = 0.55,
  reason,
  evidence = {},
}) {
  candidates.push({
    id: semanticId(candidates.length),
    schemaVersion: '1.0',
    type,
    severity,
    confidence,
    confidenceScore,
    requiresHumanApproval: true,
    source: 'semantic_consistency_audit',
    reason,
    evidence,
    location: locationFromParagraph(paragraph),
    context: {
      ...contextForParagraph(paragraphs, index),
      originalAlignedText: preview(alignment.text || null),
      alignmentConfidence: alignment.confidence,
      alignmentReason: alignment.reason,
      paragraphAlignmentConfidence: alignment.paragraphAlignmentConfidence,
      paragraphAlignmentReason: alignment.paragraphAlignmentReason,
    },
  });
}

function canPush(type, counters, total) {
  if (total >= MAX_TOTAL_CANDIDATES) return false;
  return (counters.get(type) || 0) < MAX_PER_TYPE;
}

function markPushed(type, counters) {
  counters.set(type, (counters.get(type) || 0) + 1);
}

function repeatedSequence(text) {
  const normalized = compact(text);
  const sentenceMatches = normalized.match(/([^.!?]{18,}[.!?])\s+\1/iu);
  if (sentenceMatches && wordTokens(sentenceMatches[1]).length >= 4) return sentenceMatches[1];

  const words = wordTokens(normalized);
  for (let size = 5; size <= 9; size += 1) {
    for (let index = 0; index + size * 2 <= words.length; index += 1) {
      const left = words.slice(index, index + size).join(' ');
      const right = words.slice(index + size, index + size * 2).join(' ');
      if (left === right) return left;
    }
  }
  return null;
}

function literalTranslationSignal(text) {
  const patterns = [
    { pattern: /\bde fato\b/iu, note: 'possivel literalidade de actually/in fact' },
    { pattern: /\bpor outro lado\b/iu, note: 'possivel calque discursivo' },
    { pattern: /\bno final do dia\b/iu, note: 'expressao idiomatica possivelmente literal' },
    { pattern: /\bfaz sentido\b/iu, note: 'possivel calque de makes sense' },
    { pattern: /\btomar uma decisao\b/iu, note: 'possivel formulacao literal recorrente' },
  ];
  return patterns.find(({ pattern }) => pattern.test(text)) || null;
}

function treatmentInconsistency(text) {
  if (!/["“”‘’]/u.test(text)) return null;
  const quotedSegments = String(text || '').match(/["“”‘’][^"“”‘’]{8,}["“”‘’]/gu) || [text];
  const quotedText = quotedSegments.join(' ');
  const normalized = quotedSegments.map(normalize).join(' ');
  const hasVoce = /\b(voce|voces)\b/u.test(normalized);
  const hasTu = /\b(tu|teu|tua|teus|tuas|contigo)\b/u.test(normalized);
  const hasSenhor = /\b(o senhor|a senhora|vossa|vosso|senhor[,.?!:]|senhora[,.?!:])/u.test(quotedText);
  if (hasVoce && hasTu) return 'mistura voce/tu no mesmo paragrafo';
  if (hasVoce && hasSenhor) return 'mistura tratamento informal/formal no mesmo paragrafo';
  return null;
}

function buildGlossaryLookups(glossary) {
  return [
    ...normalizeTermEntries(glossary?.terms || {}),
    ...normalizeEntityAliasEntries(glossary?.entities || {}),
  ];
}

function buildEntityNameSet(glossary) {
  const values = [];
  for (const entity of glossary?.entities?.entities || []) {
    values.push(entity.name, entity.canonical, ...(entity.aliases || []));
  }
  return new Set(values.filter(Boolean).map(normalize));
}

function auditParagraph({
  candidates,
  counters,
  paragraph,
  paragraphs,
  index,
  alignment,
  glossaryEntries,
  entityNames,
}) {
  const current = paragraph.text || '';
  const original = alignment.text || '';

  const repeated = repeatedSequence(current);
  if (repeated && canPush('semantic_repetition_anomaly', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_repetition_anomaly',
      severity: repeated.length > 80 ? 'high' : 'medium',
      confidence: 'deterministic',
      confidenceScore: 0.86,
      reason: 'Repeticao textual anormal detectada no paragrafo traduzido.',
      evidence: { repeated: preview(repeated, 180) },
    });
    markPushed('semantic_repetition_anomaly', counters);
  }

  const literal = alignment.text ? literalTranslationSignal(current) : null;
  if (literal && canPush('semantic_literal_translation_review', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_literal_translation_review',
      severity: 'low',
      confidence: 'heuristic',
      confidenceScore: 0.42,
      reason: 'Padrao de traducao possivelmente literal; requer leitura humana antes de qualquer ajuste.',
      evidence: { signal: literal.note },
    });
    markPushed('semantic_literal_translation_review', counters);
  }

  const treatment = treatmentInconsistency(current);
  if (treatment && canPush('semantic_treatment_inconsistency', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_treatment_inconsistency',
      severity: 'medium',
      confidence: 'heuristic',
      confidenceScore: 0.6,
      reason: 'Possivel inconsistencia de tratamento/personagem no mesmo paragrafo.',
      evidence: { treatment },
    });
    markPushed('semantic_treatment_inconsistency', counters);
  }

  for (const entry of glossaryEntries) {
    if (!entry.from || !entry.to) continue;
    if (!normalize(current).includes(normalize(entry.from))) continue;
    if (!canPush('semantic_terminology_inconsistency', counters, candidates.length)) break;
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_terminology_inconsistency',
      severity: entry.confidence >= 0.9 ? 'medium' : 'low',
      confidence: 'deterministic',
      confidenceScore: Math.min(Number(entry.confidence || 0.7), 0.95),
      reason: 'Forma nao canonica ainda aparece no texto traduzido segundo glossario/entidades.',
      evidence: {
        from: entry.from,
        expected: entry.to,
        glossarySource: entry.source,
      },
    });
    markPushed('semantic_terminology_inconsistency', counters);
    break;
  }

  if (!original) return;

  const ratio = lengthRatio(original, current);
  if ((ratio < 0.58 || ratio > 2.1) && canPush('semantic_omission_or_expansion_review', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_omission_or_expansion_review',
      severity: severityForRatio(ratio),
      confidence: 'heuristic',
      confidenceScore: 0.62,
      reason: 'Paragrafo alinhado tem diferenca de tamanho sugestiva de omissao, expansao ou drift semantico.',
      evidence: { lengthRatio: Number(ratio.toFixed(2)) },
    });
    markPushed('semantic_omission_or_expansion_review', counters);
  }

  const sourceNumbers = semanticallyRelevantNumbers(original);
  const translatedNumbers = new Set(semanticallyRelevantNumbers(current));
  const missingNumbers = sourceNumbers.filter((number) => !translatedNumbers.has(number));
  if (missingNumbers.length && canPush('semantic_relevant_omission_review', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_relevant_omission_review',
      severity: 'high',
      confidence: 'deterministic',
      confidenceScore: 0.78,
      reason: 'Numero presente no original alinhado nao foi encontrado na traducao.',
      evidence: { missingNumbers },
    });
    markPushed('semantic_relevant_omission_review', counters);
  }

  const protectedNames = extractProperNames(original)
    .filter((name) => entityNames.has(normalize(name)))
    .slice(0, 8);
  const missingNames = missingItems(protectedNames, current);
  if (missingNames.length >= 2 && canPush('semantic_entity_drift_review', counters, candidates.length)) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_entity_drift_review',
      severity: 'medium',
      confidence: 'heuristic',
      confidenceScore: 0.58,
      reason: 'Nomes/entidades do original alinhado parecem ausentes na traducao.',
      evidence: { missingNames: missingNames.slice(0, 6) },
    });
    markPushed('semantic_entity_drift_review', counters);
  }

  const sourcePunctuation = punctuationProfile(original);
  const translatedPunctuation = punctuationProfile(current);
  if (
    (sourcePunctuation.question !== translatedPunctuation.question ||
      sourcePunctuation.exclamation !== translatedPunctuation.exclamation) &&
    canPush('semantic_dialogue_punctuation_drift', counters, candidates.length)
  ) {
    candidateBase({
      candidates,
      paragraph,
      paragraphs,
      index,
      alignment,
      type: 'semantic_dialogue_punctuation_drift',
      severity: 'low',
      confidence: 'heuristic',
      confidenceScore: 0.5,
      reason: 'Pontuacao expressiva do original alinhado diverge da traducao.',
      evidence: { sourcePunctuation, translatedPunctuation },
    });
    markPushed('semantic_dialogue_punctuation_drift', counters);
  }
}

function summarize(candidates) {
  const count = (predicate) => candidates.filter(predicate).length;
  return {
    total: candidates.length,
    severity: {
      low: count((item) => item.severity === 'low'),
      medium: count((item) => item.severity === 'medium'),
      high: count((item) => item.severity === 'high'),
    },
    confidence: {
      deterministic: count((item) => item.confidence === 'deterministic'),
      heuristic: count((item) => item.confidence === 'heuristic'),
      modelAssisted: count((item) => item.confidence === 'model_assisted'),
    },
    byType: candidates.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function buildSemanticConsistencyAudit({
  sourceDoc,
  translationDoc,
  xhtmlMap,
  chapterAlignment,
  glossary,
  createdAt = new Date().toISOString(),
} = {}) {
  const candidates = [];
  const counters = new Map();
  const glossaryEntries = buildGlossaryLookups(glossary);
  const entityNames = buildEntityNameSet(glossary);

  for (const file of xhtmlMap?.files || []) {
    const paragraphs = file.paragraphs || [];
    for (let index = 0; index < paragraphs.length; index += 1) {
      if (candidates.length >= MAX_TOTAL_CANDIDATES) break;
      const paragraph = paragraphs[index];
      const alignment = alignedOriginalParagraphByText({
        sourceDoc,
        chapterAlignment,
        translationPath: file.filePath,
        paragraphIndex: paragraph.paragraphIndex,
        translatedParagraph: paragraph.text,
      });

      auditParagraph({
        candidates,
        counters,
        paragraph,
        paragraphs,
        index,
        alignment,
        glossaryEntries,
        entityNames,
      });
    }
  }

  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    source: {
      original: sourceDoc?.filename || null,
      translated: translationDoc?.filename || null,
    },
    policy: {
      feedsCorrectionPlan: false,
      appliesCorrections: false,
      requiresHumanApproval: true,
      maxTotalCandidates: MAX_TOTAL_CANDIDATES,
      maxPerType: MAX_PER_TYPE,
    },
    summary: summarize(candidates),
    semanticCandidates: candidates,
  };
}
