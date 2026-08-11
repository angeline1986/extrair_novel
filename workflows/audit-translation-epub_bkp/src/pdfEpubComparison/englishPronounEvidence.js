import { compact, indexSectionsByChapter, normalizeComparable } from './textUtils.js';

const ENGLISH_NAME_PATTERNS = [
  /do[- ]?i\s+h(?:yun|yeon)/iu,
  /seo\s+jeong[- ]?u?n/iu,
];

const MASCULINE_PRONOUNS = /\b(?:he|him|his|himself)\b/giu;
const FEMININE_PRONOUNS = /\b(?:she|her|hers|herself)\b/giu;
const FEMININE_ANTECEDENT = /\b(?:crian[cç]a|glande|express[aã]o|voz|m[ãa]o|apar[eê]ncia|m[ãa]e|mulher|pessoa|secret[áa]ria|funcion[áa]ria|l[ií]ngua|nuca|barriga|cabe[cç]a|entrada|forma|imagem|carta)\b/giu;
const SEMANTIC_ANCHORS = [
  [/\bsorri\w*/iu, /\bsmil\w*/iu],
  [/\bacen\w*/iu, /\bwave\w*/iu],
  [/\bpulso\b/iu, /\bwrist\b/iu],
  [/\bquebr\w*/iu, /\bbreak|broke|broken\b/iu],
  [/\bpergunt\w*/iu, /\bask\w*/iu],
  [/\bolh\w*/iu, /\blook|stare|glance\w*/iu],
  [/\bdorm\w*/iu, /\bsleep|slept|asleep\w*/iu],
  [/\bbeij\w*/iu, /\bkiss\w*/iu],
  [/\bm[ãa]e\b/iu, /\bmother\b/iu],
  [/\bfilh\w*/iu, /\bchild|son|daughter|baby\b/iu],
  [/\bgravidez|gr[áa]vid\w*/iu, /\bpregnan\w*/iu],
  [/\bcorpo\b/iu, /\bbody\b/iu],
  [/\bm[ãa]o\b/iu, /\bhand\b/iu],
  [/\bcabelo\w*/iu, /\bhair\b/iu],
  [/\brosto\b/iu, /\bface\b/iu],
  [/\bnu[ao]\b/iu, /\bnaked|nude\b/iu],
  [/\bempresa\b/iu, /\bcompany\b/iu],
  [/\bviagem\b/iu, /\btrip|travel\w*/iu],
  [/\bcomer|comeu|comia\b/iu, /\beat|ate|eating\b/iu],
  [/\bmedo\b/iu, /\bfear|afraid\b/iu],
];

function sentences(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .flatMap((paragraph) => compact(paragraph).split(/(?<=[.!?…])\s+/u))
    .map(compact)
    .filter(Boolean);
}

function chapterSentences(epubDoc, englishSource) {
  const pt = new Map();
  for (const [chapter, section] of indexSectionsByChapter(epubDoc).entries()) {
    pt.set(chapter, (section.paragraphs || []).flatMap(sentences));
  }

  const en = new Map();
  for (const chapter of englishSource?.chapters || []) {
    const chapterSentences = sentences(chapter.text);
    for (const auditChapter of chapter.auditChapters || [chapter.chapter]) {
      en.set(auditChapter, {
        ...chapter,
        sentences: chapterSentences,
      });
    }
  }
  return { pt, en };
}

function sentenceIndex(items, target) {
  const normalizedTarget = normalizeComparable(target);
  let index = items.findIndex((item) => normalizeComparable(item) === normalizedTarget);
  if (index >= 0) return index;
  index = items.findIndex((item) => {
    const normalized = normalizeComparable(item);
    return normalized.includes(normalizedTarget) || normalizedTarget.includes(normalized);
  });
  return index;
}

function nameScore(ptSentence, enSentence) {
  const ptHasMainName = /do\s*[- ]?i?[- ]?h(?:yeon|yun)|seo\s+jeongwoon/iu.test(ptSentence);
  if (!ptHasMainName) return 0;
  return ENGLISH_NAME_PATTERNS.some((pattern) => pattern.test(enSentence)) ? 0.45 : 0;
}

function semanticAnchorMatches(ptSentence, enSentence) {
  return SEMANTIC_ANCHORS.filter(([ptPattern, enPattern]) =>
    ptPattern.test(ptSentence) && enPattern.test(enSentence)
  ).length;
}

function pronounCounts(sentence) {
  return {
    masculine: [...String(sentence || '').matchAll(MASCULINE_PRONOUNS)].length,
    feminine: [...String(sentence || '').matchAll(FEMININE_PRONOUNS)].length,
  };
}

function bestEnglishSentence(ptSentence, ptIndex, ptCount, chapter) {
  const expected = ptCount > 1
    ? Math.round((ptIndex / (ptCount - 1)) * Math.max(chapter.sentences.length - 1, 0))
    : 0;
  const start = Math.max(0, expected - 18);
  const end = Math.min(chapter.sentences.length, expected + 19);
  let best = null;

  for (let index = start; index < end; index += 1) {
    const sentence = chapter.sentences[index];
    const distance = Math.abs(index - expected);
    const positionScore = Math.max(0, 0.25 - (distance / 18) * 0.25);
    const names = nameScore(ptSentence, sentence);
    const pronouns = pronounCounts(sentence);
    const pronounScore = pronouns.masculine || pronouns.feminine ? 0.15 : 0;
    const anchorMatches = semanticAnchorMatches(ptSentence, sentence);
    const anchorScore = Math.min(0.3, anchorMatches * 0.15);
    const score = positionScore + names + pronounScore + anchorScore;
    if (!best || score > best.score) {
      best = { sentence, index, expected, score, pronouns, anchorMatches };
    }
  }
  return best;
}

function decisionForPronouns(pronouns) {
  if (pronouns.masculine > 0 && pronouns.feminine === 0) return 'apply';
  if (pronouns.feminine > 0 && pronouns.masculine === 0) return 'keep';
  return null;
}

function portugueseSuggestion(sentence, term) {
  const lower = String(sentence || '').toLocaleLowerCase('pt-BR');
  const markerIndex = lower.indexOf(String(term || '').toLocaleLowerCase('pt-BR'));
  if (markerIndex < 0) return null;
  const beforeMarker = lower.slice(Math.max(0, markerIndex - 8), markerIndex);
  if (/\b(?:a|para|com|de|por)\s*$/iu.test(beforeMarker)) return null;
  const maleNames = [...lower.matchAll(/do\s*[- ]?i?[- ]?h(?:yeon|yun)|doihyeon|doihyun|seo\s+jeongwoon/giu)]
    .map((match) => match.index || 0);
  const femaleNames = [...lower.matchAll(/joo\s+na[- ]?hye|m[ãa]e|secret[áa]ria|funcion[áa]ria|mulher/giu)]
    .map((match) => match.index || 0);
  const feminineAntecedents = [...lower.matchAll(FEMININE_ANTECEDENT)]
    .map((match) => match.index || 0);
  const maleDistance = maleNames.length
    ? Math.min(...maleNames.map((index) => Math.abs(index - markerIndex)))
    : Number.POSITIVE_INFINITY;
  const femaleDistance = femaleNames.length
    ? Math.min(...femaleNames.map((index) => Math.abs(index - markerIndex)))
    : Number.POSITIVE_INFINITY;
  const maleBefore = maleNames.filter((index) => index < markerIndex);
  const femaleBefore = femaleNames.filter((index) => index < markerIndex);
  const closestMaleBefore = maleBefore.length
    ? Math.min(...maleBefore.map((index) => markerIndex - index))
    : Number.POSITIVE_INFINITY;
  const closestFemaleBefore = femaleBefore.length
    ? Math.min(...femaleBefore.map((index) => markerIndex - index))
    : Number.POSITIVE_INFINITY;
  const closestFeminineNounBefore = feminineAntecedents.filter((index) => index < markerIndex).length
    ? Math.min(...feminineAntecedents.filter((index) => index < markerIndex).map((index) => markerIndex - index))
    : Number.POSITIVE_INFINITY;
  if (closestFeminineNounBefore <= 35 && closestFeminineNounBefore < closestMaleBefore) {
    return {
      decision: 'keep',
      confidence: 'medium',
      reason: 'Um substantivo feminino recente e o antecedente gramatical mais proximo desta ocorrencia.',
    };
  }
  if (closestMaleBefore <= 55 && closestFemaleBefore > closestMaleBefore * 1.5) {
    return {
      decision: 'apply',
      confidence: 'medium',
      reason: 'O personagem masculino e o referente nominal mais proximo desta ocorrencia no contexto em portugues.',
    };
  }
  if (closestFemaleBefore <= 45 && closestMaleBefore > closestFemaleBefore * 1.5) {
    return {
      decision: 'keep',
      confidence: 'medium',
      reason: 'Uma entidade feminina conhecida e o referente nominal mais proximo desta ocorrencia.',
    };
  }
  return null;
}

export function buildPronounEvidenceIndex(epubDoc, englishSource) {
  return chapterSentences(epubDoc, englishSource);
}

export function evidenceForFinding(finding, evidenceIndex) {
  const chapterNumber = Number(finding.chapter);
  const ptSentences = evidenceIndex?.pt?.get(chapterNumber) || [];
  const englishChapter = evidenceIndex?.en?.get(chapterNumber);
  const context = finding.location || finding.translation || '';
  const ptIndex = sentenceIndex(ptSentences, context);
  const terms = finding.decisionTerms?.length
    ? finding.decisionTerms
    : String(finding.problematicTerm || '').split(/\s*\/\s*/).filter(Boolean);
  const englishMatch = englishChapter && ptIndex >= 0
    ? bestEnglishSentence(context, ptIndex, ptSentences.length, englishChapter)
    : null;
  const englishDecision = englishMatch?.score >= 0.78 && englishMatch.anchorMatches >= 1
    ? decisionForPronouns(englishMatch.pronouns)
    : null;

  const suggestions = terms.map((term) => {
    if (englishDecision) {
      return {
        term,
        decision: englishDecision,
        confidence: 'medium',
        source: 'english_positional_alignment',
        reason: `Candidato inglês alinhado por posição, personagem e âncora lexical; requer confirmação semântica. Pronomes EN masculinos=${englishMatch.pronouns.masculine}, femininos=${englishMatch.pronouns.feminine}.`,
      };
    }
    const portuguese = portugueseSuggestion(context, term);
    return portuguese ? { term, source: 'portuguese_coreference', ...portuguese } : null;
  }).filter(Boolean);

  if (!englishChapter) {
    return {
      status: 'english_chapter_unavailable',
      confidence: 'low',
      text: '',
      reason: `O capítulo ${chapterNumber} ainda não possui fonte inglesa alinhada.`,
      suggestions,
    };
  }
  if (!englishMatch || englishMatch.score < 0.78 || englishMatch.anchorMatches < 1) {
    return {
      status: 'english_alignment_uncertain',
      confidence: 'low',
      text: englishMatch?.sentence || '',
      reason: 'O alinhamento não reuniu posição, personagem e âncora semântica suficientes; a decisão inglesa não foi pré-marcada.',
      score: englishMatch?.score || 0,
      suggestions,
    };
  }
  return {
    status: englishDecision ? 'english_context_found' : 'english_pronouns_mixed',
    confidence: 'medium',
    text: englishMatch.sentence,
    reason: englishDecision
      ? 'Foi encontrado um candidato inglês compatível, mas a equivalência semântica ainda requer confirmação.'
      : 'A frase inglesa alinhada contém pronomes masculinos e femininos; exige validação humana.',
    score: englishMatch.score,
    source: englishChapter.source,
    chapterTitle: englishChapter.title,
    suggestions,
  };
}
