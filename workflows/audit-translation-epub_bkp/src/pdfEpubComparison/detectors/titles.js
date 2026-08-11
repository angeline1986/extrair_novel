import { dedupeFindings, makeFinding } from '../findingFactory.js';
import {
  expectedTitleTranslation,
  titleSatisfiesRecommendation,
} from '../titleTerms.js';
import { titleForSection } from '../textUtils.js';

export function detectTitleFindings(pdfByChapter, epubByChapter) {
  const findings = [];

  for (const [chapter, pdfSection] of pdfByChapter.entries()) {
    const epubSection = epubByChapter.get(chapter);
    if (!epubSection) continue;

    const pdfTitle = titleForSection(pdfSection);
    const epubTitle = titleForSection(epubSection);
    const expected = expectedTitleTranslation(pdfTitle);

    if (expected && !titleSatisfiesRecommendation(epubTitle, expected)) {
      findings.push(makeFinding({
        group: 'titles',
        chapter,
        type: 'Título divergente',
        original: pdfTitle,
        translation: epubTitle,
        problem: 'Título do EPUB não corresponde à tradução esperada do título no PDF.',
        recommendation: `Verificar se o título deveria conter "${expected}".`,
        location: 'Título do capítulo',
        severity: 'high',
      }));
    }

    const ratio = (epubSection.charCount || 0) / Math.max(pdfSection.charCount || 1, 1);
    if (pdfSection.charCount > 3000 && (ratio < 0.55 || ratio > 2.3)) {
      findings.push(makeFinding({
        group: 'coverage',
        chapter,
        type: 'Diferença extrema de tamanho',
        original: `${pdfSection.charCount} caracteres no PDF`,
        translation: `${epubSection.charCount} caracteres no EPUB`,
        problem: `Diferença extrema de extensão entre PDF e EPUB (${ratio.toFixed(2)}x).`,
        recommendation: 'Revisar alinhamento e cobertura do capítulo.',
        location: epubTitle,
        severity: 'medium',
      }));
    }
  }

  return dedupeFindings(findings);
}
