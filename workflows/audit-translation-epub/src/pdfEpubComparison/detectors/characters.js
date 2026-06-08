import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { compact, escapeRegExp, textHasTerm } from '../textUtils.js';

const FEMININE_PRONOUNS = [
  'ela',
  'dela',
  'nela',
  'aquela',
  'sozinha',
  'cansada',
  'preocupada',
  'irritada',
  'perfeita',
  'bonita',
  'chocada',
  'assustada',
  'envergonhada',
  'nervosa',
];

const FEMININE_NOUNS_AFTER_DEMONSTRATIVE = [
  'aparencia',
  'aparência',
  'conversa',
  'historia',
  'história',
  'mudanca',
  'mudança',
  'personalidade',
  'pessoa',
  'respiracao',
  'respiração',
  'sensacao',
  'sensação',
  'voz',
];

const FEMININE_NOUN_SUFFIXES_AFTER_DEMONSTRATIVE = [
  'ção',
  'cao',
  'são',
  'sao',
  'dade',
  'gem',
  'ência',
  'encia',
  'ância',
  'ancia',
];

const ENGLISH_MARKERS_BY_PT = new Map([
  ['sozinha', ['alone']],
  ['cansada', ['tired', 'exhausted']],
  ['preocupada', ['worried', 'concerned']],
  ['irritada', ['irritated', 'annoyed']],
  ['perfeita', ['perfect']],
  ['bonita', ['beautiful', 'pretty']],
  ['chocada', ['shocked']],
  ['assustada', ['scared', 'frightened', 'startled']],
  ['envergonhada', ['embarrassed', 'ashamed']],
  ['nervosa', ['nervous']],
  ['ela', ['she', 'her']],
  ['dela', ['her', 'hers']],
  ['nela', ['her']],
]);

function mainMaleCharacters(glossary) {
  const entities = glossary?.entities?.entities || [];
  return entities
    .filter((entity) => /protagonista|interesse amoroso|masculino|história/i.test(`${entity.role || ''} ${entity.note || ''}`))
    .filter((entity) => /Do Yi-hyeon|Seo Jeongwoon/i.test(entity.canonical || ''))
    .map((entity) => ({
      canonical: entity.canonical,
      names: [
        entity.canonical,
        ...(entity.aliases || []).map((alias) => alias.from),
      ].filter(Boolean),
    }));
}

function knownFemaleCharacters(glossary) {
  const entities = glossary?.entities?.entities || [];
  return entities
    .filter((entity) => /amiga|m[ãa]e|secret[áa]ria|feminino/i.test(`${entity.role || ''} ${entity.note || ''}`))
    .map((entity) => ({
      canonical: entity.canonical,
      names: [
        entity.canonical,
        ...(entity.aliases || []).map((alias) => alias.from),
      ].filter(Boolean),
    }));
}

function indexEnglishChapters(englishSource) {
  const index = new Map();
  for (const chapter of englishSource?.chapters || []) {
    for (const auditChapter of chapter.auditChapters || [chapter.chapter]) {
      if (Number.isInteger(auditChapter)) index.set(auditChapter, chapter);
    }
  }
  return index;
}

export function feminineMarkersIn(text) {
  const lower = String(text || '').toLowerCase();
  return FEMININE_PRONOUNS.filter((marker) => {
    const regex = new RegExp(`(^|[^\\p{L}])${marker}(?=$|[^\\p{L}])`, 'u');
    if (!regex.test(lower)) return false;
    if (marker === 'aquela' && demonstrativeModifiesFeminineNoun(lower, marker)) return false;
    return true;
  });
}

function demonstrativeModifiesFeminineNoun(text, marker) {
  const match = text.match(new RegExp(`(^|[^\\p{L}])${marker}\\s+(\\p{L}+)`, 'u'));
  const noun = match?.[2] || '';
  if (!noun) return false;
  if (FEMININE_NOUNS_AFTER_DEMONSTRATIVE.includes(noun)) return true;
  return FEMININE_NOUN_SUFFIXES_AFTER_DEMONSTRATIVE.some((suffix) => noun.endsWith(suffix));
}

function paragraphHasAnyName(paragraph, names) {
  return names.find((name) => textHasTerm(paragraph, name));
}

function matchingMaleCharacters(sentence, characters) {
  return characters
    .map((character) => {
      const name = paragraphHasAnyName(sentence, character.names);
      return name ? { canonical: character.canonical, matchedName: name } : null;
    })
    .filter(Boolean);
}

function matchingCharacters(sentence, characters) {
  return characters
    .map((character) => {
      const name = paragraphHasAnyName(sentence, character.names);
      return name ? { canonical: character.canonical, matchedName: name } : null;
    })
    .filter(Boolean);
}

function sentencesFromParagraph(paragraph) {
  return compact(paragraph)
    .split(/(?<=[.!?…])\s+/u)
    .map(compact)
    .filter(Boolean);
}

function englishSentences(chapter) {
  return String(chapter?.text || '')
    .split(/\n{2,}/)
    .flatMap((paragraph) => compact(paragraph).split(/(?<=[.!?…])\s+/u))
    .map(compact)
    .filter(Boolean);
}

function characterNameFragments(match) {
  return [
    match.canonical,
    match.matchedName,
    ...String(match.canonical || '').split(/\s+/).filter((part) => part.length > 2),
    ...String(match.matchedName || '').split(/\s+/).filter((part) => part.length > 2),
  ].filter(Boolean);
}

function sentenceHasAnyName(sentence, matches) {
  return matches.some((match) =>
    characterNameFragments(match).some((name) => textHasTerm(sentence, name))
  );
}

function sentenceHasAnyEquivalent(sentence, marker) {
  const equivalents = ENGLISH_MARKERS_BY_PT.get(marker) || [];
  return equivalents.find((term) => textHasTerm(sentence, term));
}

function indexesOfTerm(text, term) {
  const indexes = [];
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(term)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  for (const match of String(text || '').matchAll(pattern)) {
    indexes.push((match.index || 0) + match[1].length);
  }
  return indexes;
}

function closestDistance(text, terms, marker) {
  const markerIndexes = indexesOfTerm(text, marker);
  if (!markerIndexes.length) return Number.POSITIVE_INFINITY;
  const termIndexes = terms.flatMap((term) => indexesOfTerm(text, term));
  if (!termIndexes.length) return Number.POSITIVE_INFINITY;
  return Math.min(...markerIndexes.flatMap((markerIndex) =>
    termIndexes.map((termIndex) => Math.abs(markerIndex - termIndex))
  ));
}

function markerLikelyBelongsToFemaleEntity(sentence, marker, maleMatches, femaleMatches) {
  if (!femaleMatches.length) return false;
  const femaleNames = femaleMatches.flatMap((match) => characterNameFragments(match));
  const maleNames = maleMatches.flatMap((match) => characterNameFragments(match));
  return closestDistance(sentence, femaleNames, marker) < closestDistance(sentence, maleNames, marker);
}

function findEnglishEvidence({ chapter, marker, matches, englishByChapter }) {
  const englishChapter = englishByChapter.get(Number(chapter));
  if (!englishChapter) return null;

  const sentences = englishSentences(englishChapter);
  const withNameAndMarker = sentences.find((sentence) =>
    sentenceHasAnyName(sentence, matches) && sentenceHasAnyEquivalent(sentence, marker)
  );
  if (withNameAndMarker) {
    return {
      status: 'confirmed_by_english',
      confidence: 'high',
      chapter,
      chapterTitle: englishChapter.title,
      source: englishChapter.source,
      text: withNameAndMarker,
      reason: 'O trecho em inglês contém o personagem masculino e um equivalente do marcador em português.',
    };
  }

  const withMarker = sentences.find((sentence) => sentenceHasAnyEquivalent(sentence, marker));
  if (withMarker) {
    return {
      status: 'english_context_found',
      confidence: 'medium',
      chapter,
      chapterTitle: englishChapter.title,
      source: englishChapter.source,
      text: withMarker,
      reason: 'O capítulo em inglês contém um equivalente do marcador, mas a ligação com o personagem exige validação humana.',
    };
  }

  return {
    status: 'no_english_match',
    confidence: 'low',
    chapter,
    chapterTitle: englishChapter.title,
    source: englishChapter.source,
    text: '',
    reason: 'Nenhum equivalente direto foi encontrado no capítulo em inglês.',
  };
}

function recommendationWithEvidence(baseRecommendation, evidence) {
  if (!evidence || evidence.status !== 'confirmed_by_english') return baseRecommendation;
  return `${baseRecommendation} Evidência EN encontrada no mesmo capítulo.`;
}

export function detectCharacterFindings(epubDoc, glossary = {}, { englishSource = null } = {}) {
  const findings = [];
  const characters = mainMaleCharacters(glossary);
  const femaleCharacters = knownFemaleCharacters(glossary);
  const englishByChapter = indexEnglishChapters(englishSource);
  if (!characters.length) return findings;

  for (const section of epubDoc.sections || []) {
    const chapter = section.chapterNumber || section.index + 1;
    for (const paragraph of section.paragraphs || []) {
      for (const sentence of sentencesFromParagraph(paragraph)) {
        const markers = feminineMarkersIn(sentence);
        if (!markers.length) continue;
        const matches = matchingMaleCharacters(sentence, characters);
        if (!matches.length) continue;
        const femaleMatches = matchingCharacters(sentence, femaleCharacters);
        if (markers.every((marker) => markerLikelyBelongsToFemaleEntity(sentence, marker, matches, femaleMatches))) {
          continue;
        }
        const canonicalNames = [...new Set(matches.map((match) => match.canonical))];
        const matchedNames = [...new Set(matches.map((match) => match.matchedName))];
        const isComposite = markers.length > 1;
        const marker = markers[0];
        const englishEvidence = findEnglishEvidence({
          chapter,
          marker,
          matches,
          englishByChapter,
        });
        const baseRecommendation = isComposite
          ? 'Revisar frase inteira manualmente; manter termos que se referem a substantivos femininos e corrigir apenas os que se referem ao personagem masculino.'
          : 'Validar se o pronome/adjetivo deveria estar no masculino.';
        findings.push(makeFinding({
          sourceValidation: englishEvidence ? {
            status: englishEvidence.status,
            confidence: englishEvidence.confidence,
            reason: englishEvidence.reason,
          } : null,
          englishEvidence,
          group: 'characters',
          chapter,
          type: isComposite ? 'Gênero composto' : 'Pronome ou gênero incompatível',
          original: matchedNames.join(', '),
          translation: sentence,
          problem: isComposite
            ? `A frase tem múltiplos marcadores femininos (${markers.map((item) => `"${item}"`).join(', ')}) perto de ${canonicalNames.join(' e ')}. Nem todos necessariamente se referem ao personagem masculino.`
            : `"${marker}" aparece na mesma frase de ${canonicalNames.join(' e ')}, personagem(ns) masculino(s).`,
          recommendation: isComposite
            ? recommendationWithEvidence(baseRecommendation, englishEvidence)
            : recommendationWithEvidence(baseRecommendation, englishEvidence),
          location: sentence,
          problematicTerm: isComposite ? markers.join(' / ') : marker,
          severity: /ela|dela|nela/.test(marker) ? 'critical' : 'high',
          confidence: englishEvidence?.status === 'confirmed_by_english' ? 'high' : 'medium',
        }));
      }
    }
  }

  return dedupeFindings(findings);
}
