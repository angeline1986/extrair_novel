import {
  findResidualSpanishPhrases,
  isCommonWord,
  normalizeComparableText,
  normalizeLexiconWord,
  SPANISH_STRONG_MARKERS,
  tokenizeLexiconText,
} from '../../languageLexicons.js';
import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { SPANISH_PHRASE_RECOMMENDATIONS, SPANISH_TO_PORTUGUESE_TERMS } from '../titleTerms.js';
import { titleForSection } from '../textUtils.js';

function recommendationForPhrase(phrase) {
  return SPANISH_PHRASE_RECOMMENDATIONS.get(normalizeComparableText(phrase)) ||
    'Traduzir a frase residual para PT-BR conforme contexto.';
}

function recommendationForMarker(marker) {
  return SPANISH_TO_PORTUGUESE_TERMS.get(marker) ||
    SPANISH_TO_PORTUGUESE_TERMS.get(normalizeLexiconWord(marker)) ||
    'Traduzir para PT-BR conforme contexto.';
}

function blocksForSection(section) {
  const title = titleForSection(section);
  return [
    { kind: 'Título', text: title },
    ...(section.paragraphs || [])
      .filter((text) => normalizeComparableText(text) !== normalizeComparableText(title))
      .map((text, index) => ({ kind: `Parágrafo ${index + 1}`, text })),
  ];
}

export function detectResidualLanguageFindings(epubDoc) {
  const findings = [];
  const seen = new Set();

  for (const section of epubDoc.sections || []) {
    const chapter = section.chapterNumber || section.index + 1;
    for (const block of blocksForSection(section)) {
      pushPhraseFindings(findings, seen, chapter, block);
      pushMarkerFindings(findings, seen, chapter, block);
    }
  }

  return dedupeFindings(findings);
}

function pushPhraseFindings(findings, seen, chapter, block) {
  for (const phrase of findResidualSpanishPhrases(block.text)) {
    const key = `${chapter}:${phrase}:${block.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(makeFinding({
      group: 'residual_language',
      chapter,
      type: 'Expressão inteira em espanhol',
      original: phrase,
      translation: phrase,
      problem: 'Expressão em espanhol permaneceu no EPUB traduzido.',
      recommendation: recommendationForPhrase(phrase),
      location: `${block.kind}: ${block.text}`,
      problematicTerm: phrase,
      severity: 'critical',
      confidence: 'high',
      classification: 'informative',
    }));
  }
}

function pushMarkerFindings(findings, seen, chapter, block) {
  const markers = [...new Set(tokenizeLexiconText(block.text).filter((token) =>
    SPANISH_STRONG_MARKERS.has(token) && !isCommonWord(token, 'pt')
  ))];

  for (const marker of markers) {
    const key = `${chapter}:${marker}:${block.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(makeFinding({
      group: block.kind === 'Título' ? 'titles' : 'residual_language',
      chapter,
      type: block.kind === 'Título' ? 'Título em espanhol' : 'Espanhol residual',
      original: marker,
      translation: marker,
      problem: 'Termo espanhol residual aparece no EPUB traduzido.',
      recommendation: recommendationForMarker(marker),
      location: `${block.kind}: ${block.text}`,
      problematicTerm: marker,
      severity: block.kind === 'Título' ? 'high' : 'medium',
      confidence: 'high',
      classification: 'informative',
    }));
  }
}
