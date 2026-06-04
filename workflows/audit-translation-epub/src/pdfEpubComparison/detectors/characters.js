import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { compact, textHasTerm } from '../textUtils.js';

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
  'chocada',
  'assustada',
  'envergonhada',
  'nervosa',
];

const FEMININE_NOUNS_AFTER_DEMONSTRATIVE = [
  'conversa',
  'historia',
  'história',
  'mudanca',
  'mudança',
  'personalidade',
  'pessoa',
  'voz',
];

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

function feminineMarkersIn(text) {
  const lower = String(text || '').toLowerCase();
  return FEMININE_PRONOUNS.filter((marker) => {
    const regex = new RegExp(`(^|[^\\p{L}])${marker}(?=$|[^\\p{L}])`, 'u');
    if (!regex.test(lower)) return false;
    if (marker === 'aquela' && demonstrativeModifiesFeminineNoun(lower, marker)) return false;
    return true;
  });
}

function demonstrativeModifiesFeminineNoun(text, marker) {
  return FEMININE_NOUNS_AFTER_DEMONSTRATIVE.some((noun) => {
    const regex = new RegExp(`(^|[^\\p{L}])${marker}\\s+${noun}(?=$|[^\\p{L}])`, 'u');
    return regex.test(text);
  });
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

function sentencesFromParagraph(paragraph) {
  return compact(paragraph)
    .split(/(?<=[.!?…])\s+/u)
    .map(compact)
    .filter(Boolean);
}

export function detectCharacterFindings(epubDoc, glossary = {}) {
  const findings = [];
  const characters = mainMaleCharacters(glossary);
  if (!characters.length) return findings;

  for (const section of epubDoc.sections || []) {
    const chapter = section.chapterNumber || section.index + 1;
    for (const paragraph of section.paragraphs || []) {
      for (const sentence of sentencesFromParagraph(paragraph)) {
        const markers = feminineMarkersIn(sentence);
        if (!markers.length) continue;
        const matches = matchingMaleCharacters(sentence, characters);
        if (!matches.length) continue;
        const canonicalNames = [...new Set(matches.map((match) => match.canonical))];
        const matchedNames = [...new Set(matches.map((match) => match.matchedName))];
        const isComposite = markers.length > 1;
        const marker = markers[0];
        findings.push(makeFinding({
          group: 'characters',
          chapter,
          type: isComposite ? 'Gênero composto' : 'Pronome ou gênero incompatível',
          original: matchedNames.join(', '),
          translation: sentence,
          problem: isComposite
            ? `A frase tem múltiplos marcadores femininos (${markers.map((item) => `"${item}"`).join(', ')}) perto de ${canonicalNames.join(' e ')}. Nem todos necessariamente se referem ao personagem masculino.`
            : `"${marker}" aparece na mesma frase de ${canonicalNames.join(' e ')}, personagem(ns) masculino(s).`,
          recommendation: isComposite
            ? 'Revisar frase inteira manualmente; manter termos que se referem a substantivos femininos e corrigir apenas os que se referem ao personagem masculino.'
            : 'Validar se o pronome/adjetivo deveria estar no masculino.',
          location: sentence,
          problematicTerm: isComposite ? markers.join(' / ') : marker,
          severity: /ela|dela|nela/.test(marker) ? 'critical' : 'high',
          confidence: 'medium',
        }));
      }
    }
  }

  return dedupeFindings(findings);
}
