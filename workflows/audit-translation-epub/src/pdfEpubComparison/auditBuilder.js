import { buildGroupedCategories, sortFindings } from './taxonomy.js';
import { dedupeFindings } from './findingFactory.js';
import { indexSectionsByChapter } from './textUtils.js';
import { detectCharacterFindings } from './detectors/characters.js';
import { detectCoverageFindings } from './detectors/coverage.js';
import { detectMeaningFindings } from './detectors/meaning.js';
import { detectResidualLanguageFindings } from './detectors/residualLanguage.js';
import { detectTerminologyFindings } from './detectors/terminology.js';
import { detectTitleFindings } from './detectors/titles.js';

function auditInputs(pdfDoc, epubDoc, epubTarget) {
  return {
    pdf: pdfDoc ? {
      filePath: pdfDoc.filePath,
      filename: pdfDoc.filename,
      pageCount: pdfDoc.pageCount,
      sections: pdfDoc.sections?.length || 0,
      textBlocks: pdfDoc.textBlockCount || pdfDoc.paragraphCount || 0,
    } : null,
    epub: epubDoc ? {
      filePath: epubDoc.filePath,
      filename: epubDoc.filename,
      sections: epubDoc.sections?.length || 0,
      paragraphs: epubDoc.paragraphCount || 0,
    } : null,
    epubTarget,
  };
}

export function buildPdfEpubComparisonAudit({
  pdfDoc,
  epubDoc,
  glossary = {},
  epubTarget = null,
} = {}) {
  const pdfByChapter = indexSectionsByChapter(pdfDoc);
  const epubByChapter = indexSectionsByChapter(epubDoc);
  const findings = sortFindings(dedupeFindings([
    ...detectCoverageFindings(pdfByChapter, epubByChapter, epubDoc),
    ...detectTitleFindings(pdfByChapter, epubByChapter),
    ...detectTerminologyFindings(pdfDoc, epubDoc, glossary),
    ...detectResidualLanguageFindings(epubDoc),
    ...detectCharacterFindings(epubDoc, glossary),
    ...detectMeaningFindings(epubDoc),
  ]));
  const categories = buildGroupedCategories(findings);

  return {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    inputs: auditInputs(pdfDoc, epubDoc, epubTarget),
    summary: {
      totalFindings: findings.length,
      categories: Object.fromEntries(categories.map((item) => [item.id, item.count])),
      pdfChapters: pdfByChapter.size,
      epubChapters: epubByChapter.size,
      taxonomy: 'pdf_epub_editorial_groups_v1',
    },
    categories,
  };
}
