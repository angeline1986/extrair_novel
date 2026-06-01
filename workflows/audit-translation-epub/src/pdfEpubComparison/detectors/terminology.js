import {
  isCommonWord,
  isStrongLanguageMarker,
  normalizeLexiconWord,
  tokenizeLexiconText,
} from '../../languageLexicons.js';
import { normalizeEntityAliasEntries } from '../../correction/entityNormalizer.js';
import { normalizeTermEntries } from '../../correction/terminologyNormalizer.js';
import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { SPANISH_TO_PORTUGUESE_TERMS } from '../titleTerms.js';
import {
  containsNormalized,
  sentenceContaining,
  textHasTerm,
  titleForSection,
} from '../textUtils.js';

function termFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

export function detectTerminologyFindings(pdfDoc, epubDoc, glossary = {}) {
  const findings = [];
  const terms = normalizeTermEntries(glossary.terms || { terms: [] });
  const entities = normalizeEntityAliasEntries(glossary.entities || { entities: [] });
  const epubText = epubDoc.rawText || '';

  for (const entry of [...terms, ...entities]) {
    if (containsNormalized(epubText, entry.from) && !containsNormalized(epubText, entry.to)) {
      findings.push(makeFinding({
        group: 'terminology',
        chapter: '-',
        type: 'Termo do glossário divergente',
        original: entry.from,
        translation: entry.from,
        problem: 'Forma antiga/original aparece no EPUB, mas a forma recomendada não foi encontrada.',
        recommendation: `Padronizar para "${entry.to}".`,
        location: 'EPUB completo',
        severity: entry.mode === 'auto_safe' ? 'medium' : 'low',
      }));
    }
  }

  const pdfTokens = termFrequency(tokenizeLexiconText(pdfDoc.rawText || ''));
  const epubTokens = termFrequency(tokenizeLexiconText(epubText));
  for (const [term, recommendation] of SPANISH_TO_PORTUGUESE_TERMS.entries()) {
    const normalized = normalizeLexiconWord(term);
    if (!(epubTokens.get(normalized) > 0 && pdfTokens.get(normalized) > 0)) continue;
    if (isCommonWord(normalized, 'pt')) continue;
    pushSpanishTermFindings(findings, epubDoc, term, recommendation, normalized);
  }

  return dedupeFindings(findings);
}

function pushSpanishTermFindings(findings, epubDoc, term, recommendation, normalized) {
  const sections = (epubDoc.sections || [])
    .filter((section) => textHasTerm(section.rawText || section.paragraphs?.join('\n') || '', term))
    .slice(0, 6);

  for (const section of sections.length ? sections : [null]) {
    const sectionText = section ? (section.rawText || section.paragraphs?.join('\n') || '') : epubDoc.rawText;
    const chapter = section ? (section.chapterNumber || section.index + 1) : '-';
    const sectionTitle = section ? titleForSection(section) : '';
    const termIsInTitle = sectionTitle && textHasTerm(sectionTitle, term);
    const sentence = termIsInTitle ? sectionTitle : sentenceContaining(sectionText, term);

    findings.push(makeFinding({
      group: termIsInTitle ? 'titles' : 'terminology',
      chapter,
      type: termIsInTitle ? 'Título em espanhol' : 'Termo espanhol ainda presente',
      original: term,
      translation: sentence,
      problem: 'Termo espanhol aparece no EPUB traduzido.',
      recommendation: `Avaliar substituição por "${recommendation}".`,
      location: termIsInTitle ? `Título do capítulo ${chapter}: ${sectionTitle}` : sentence,
      problematicTerm: term,
      severity: isStrongLanguageMarker(normalized, 'es') ? 'high' : 'medium',
    }));
  }
}
