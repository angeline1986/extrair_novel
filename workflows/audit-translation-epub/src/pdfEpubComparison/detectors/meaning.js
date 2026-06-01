import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { sentenceContaining } from '../textUtils.js';

const INTERMEDIATE_TRANSLATION_PATTERNS = [
  {
    term: 'conheceu',
    type: 'Verbo ambíguo met',
    problem: '"conheceu" pode ter herdado ambiguidade de met/conocer.',
    recommendation: 'Verificar se o contexto pede "encontrou", "reencontrou" ou "se encontrou com".',
  },
  {
    term: 'ligou',
    type: 'Verbo ambíguo call',
    problem: '"ligou" pode ter herdado ambiguidade de call/llamar.',
    recommendation: 'Verificar se o contexto pede "chamou", "telefonou" ou "disse".',
  },
  {
    term: 'chamada',
    type: 'Verbo ambíguo call',
    problem: '"chamada" pode indicar tradução intermediária de call.',
    recommendation: 'Validar se significa telefonema, chamado ou forma de tratamento.',
  },
];

function termPattern(term) {
  return new RegExp(`(^|[^\\p{L}])${term}(?=$|[^\\p{L}])`, 'iu');
}

export function detectMeaningFindings(epubDoc) {
  const findings = [];

  for (const section of epubDoc.sections || []) {
    const chapter = section.chapterNumber || section.index + 1;
    for (const paragraph of section.paragraphs || []) {
      for (const pattern of INTERMEDIATE_TRANSLATION_PATTERNS) {
        if (!termPattern(pattern.term).test(paragraph)) continue;
        findings.push(makeFinding({
          group: 'meaning',
          chapter,
          type: pattern.type,
          original: pattern.term,
          translation: sentenceContaining(paragraph, pattern.term),
          problem: pattern.problem,
          recommendation: pattern.recommendation,
          location: sentenceContaining(paragraph, pattern.term),
          problematicTerm: pattern.term,
          severity: 'medium',
          confidence: 'low',
        }));
      }
    }
  }

  return dedupeFindings(findings);
}
