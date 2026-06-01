import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { compact, textHasTerm } from '../textUtils.js';

const FEMININE_PRONOUNS = ['ela', 'dela', 'nela', 'aquela', 'sozinha', 'cansada', 'preocupada', 'irritada'];

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

function hasFeminineMarker(text) {
  const lower = String(text || '').toLowerCase();
  return FEMININE_PRONOUNS.find((marker) => new RegExp(`(^|[^\\p{L}])${marker}(?=$|[^\\p{L}])`, 'u').test(lower));
}

function paragraphHasAnyName(paragraph, names) {
  return names.find((name) => textHasTerm(paragraph, name));
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
        const marker = hasFeminineMarker(sentence);
        if (!marker) continue;
        for (const character of characters) {
          const name = paragraphHasAnyName(sentence, character.names);
          if (!name) continue;
          findings.push(makeFinding({
            group: 'characters',
            chapter,
            type: 'Pronome ou gênero incompatível',
            original: name,
            translation: sentence,
            problem: `"${marker}" aparece na mesma frase de ${character.canonical}, personagem masculino.`,
            recommendation: 'Validar se o pronome/adjetivo deveria estar no masculino.',
            location: sentence,
            problematicTerm: marker,
            severity: /ela|dela|nela/.test(marker) ? 'critical' : 'high',
            confidence: 'medium',
          }));
        }
      }
    }
  }

  return dedupeFindings(findings);
}
