import { dedupeFindings, makeFinding } from '../findingFactory.js';
import { sentenceContaining, titleForSection } from '../textUtils.js';
import {
  extractNumbers,
  extractProperNames,
  hasEquivalentNumber,
  missingItems,
} from './coverageHelpers.js';

export function detectCoverageFindings(pdfByChapter, epubByChapter, epubDoc) {
  const findings = [];
  const epubFullText = epubDoc?.rawText || '';

  for (const [chapter, pdfSection] of pdfByChapter.entries()) {
    const epubSection = epubByChapter.get(chapter);
    if (!epubSection) {
      findings.push(makeFinding({
        group: 'coverage',
        chapter,
        type: 'Capítulo ausente',
        original: titleForSection(pdfSection),
        problem: 'Capítulo identificado no PDF não foi encontrado no EPUB alvo.',
        recommendation: 'Verificar se o capítulo foi omitido, mesclado ou renumerado.',
        location: 'Estrutura de capítulos',
        severity: 'high',
      }));
      continue;
    }

    const pdfText = pdfSection.rawText || '';
    const epubText = epubSection.rawText || '';
    const ratio = (epubSection.charCount || 0) / Math.max(pdfSection.charCount || 1, 1);

    if (pdfSection.charCount > 3000 && ratio < 0.45) {
      findings.push(makeFinding({
        group: 'coverage',
        chapter,
        type: 'Possível omissão estrutural',
        original: titleForSection(pdfSection),
        translation: titleForSection(epubSection),
        problem: `Capítulo do EPUB tem tamanho muito menor que o PDF equivalente (${ratio.toFixed(2)}x).`,
        recommendation: 'Conferir se cenas ou blocos narrativos foram omitidos.',
        location: titleForSection(epubSection),
        severity: 'high',
      }));
    }

    const missingNumbers = extractNumbers(pdfText)
      .filter((number) => !/^\d$/.test(number))
      .filter((number) => !hasEquivalentNumber(epubText, pdfText, number))
      .filter((number) => !hasEquivalentNumber(epubFullText, pdfText, number))
      .slice(0, 5);

    for (const number of missingNumbers) {
      findings.push(makeFinding({
        group: 'coverage',
        chapter,
        type: 'Número ausente',
        original: sentenceContaining(pdfText, number),
        translation: 'Não encontrado no EPUB.',
        problem: `O número "${number}" aparece no PDF, mas não foi localizado no EPUB traduzido.`,
        recommendation: 'Conferir se dado, horário, idade ou quantidade foi omitido ou alterado.',
        location: `PDF: ${sentenceContaining(pdfText, number)}`,
        problematicTerm: number,
        severity: 'high',
      }));
    }

    const missingNames = missingItems(extractProperNames(pdfText).slice(0, 40), epubText).slice(0, 6);
    if (missingNames.length >= 4) {
      findings.push(makeFinding({
        group: 'coverage',
        chapter,
        type: 'Nome ou entidade ausente',
        original: missingNames.join(', '),
        translation: titleForSection(epubSection),
        problem: 'Vários nomes ou entidades do PDF não aparecem no capítulo correspondente do EPUB.',
        recommendation: 'Validar se houve tradução/romanização esperada ou omissão real.',
        location: titleForSection(epubSection),
      }));
    }
  }

  return dedupeFindings(findings);
}
