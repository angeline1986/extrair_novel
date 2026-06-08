import { buildGroupedCategories, sortFindings } from './taxonomy.js';
import { dedupeFindings } from './findingFactory.js';
import { dedupeKeyFromFinding, stableKeyFromFinding } from './reviewQueueKeys.js';
import { indexSectionsByChapter, stripChapterNumber, titleForSection } from './textUtils.js';
import { englishChapterTitleMap } from './englishSource.js';
import { detectCharacterFindings, feminineMarkersIn } from './detectors/characters.js';
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

function buildChapterTitleMap({ pdfByChapter, epubByChapter, englishSource }) {
  const titles = englishChapterTitleMap(englishSource);

  for (const [chapter, section] of pdfByChapter.entries()) {
    const title = stripChapterNumber(titleForSection(section));
    if (title && title !== '-') titles.set(chapter, title);
  }

  for (const [chapter, section] of epubByChapter.entries()) {
    const title = stripChapterNumber(titleForSection(section));
    if (title && title !== '-') titles.set(chapter, title);
  }

  return titles;
}

function enrichFindingWithChapterTitle(finding, chapterTitles) {
  const chapter = Number(finding?.chapter);
  if (!Number.isInteger(chapter)) return finding;
  const chapterTitle = chapterTitles.get(chapter);
  if (!chapterTitle) return finding;
  return {
    ...finding,
    chapterTitle,
  };
}

function pendingFindingFromQueueItem(item) {
  const group = item.categoryId || item.group || 'editorial';
  const decisionTerms = group === 'characters'
    ? [...new Set([
      item.problematicTerm,
      ...feminineMarkersIn(`${item.translation || ''} ${item.location || ''} ${item.problem || ''}`),
    ].filter(Boolean))]
    : [];
  return {
    group,
    chapter: item.chapter || '-',
    type: item.type || item.categoryLabel || 'Achado pendente',
    original: item.original || item.sourceTerm || '',
    translation: item.translation || '',
    problem: item.problem || 'Achado pendente de validacao anterior.',
    recommendation: item.recommendation || 'Validar manualmente no contexto.',
    location: item.location || item.translation || '',
    problematicTerm: item.problematicTerm || '',
    decisionTerms,
    severity: item.severity || 'medium',
    confidence: item.confidence || 'medium',
    classification: 'pending_review_carryover',
    carriedOver: true,
    reviewId: item.id,
    stableKey: item.stableKey,
    dedupeKey: item.dedupeKey,
    reviewStatus: item.status,
  };
}

function carryOverPendingFindings(existingQueue, currentFindings) {
  const stableKeys = new Set();
  const dedupeKeys = new Set();

  for (const finding of currentFindings || []) {
    const category = { id: finding.group };
    const stableKey = stableKeyFromFinding(category, finding);
    const dedupeKey = dedupeKeyFromFinding(category, finding);
    if (stableKey) stableKeys.add(stableKey);
    if (dedupeKey) dedupeKeys.add(dedupeKey);
  }

  return (existingQueue?.items || [])
    .filter((item) => item.status === 'pending')
    .map(pendingFindingFromQueueItem)
    .filter((finding) => {
      const category = { id: finding.group };
      const stableKey = stableKeyFromFinding(category, finding);
      const dedupeKey = dedupeKeyFromFinding(category, finding);
      return !(stableKey && stableKeys.has(stableKey)) && !(dedupeKey && dedupeKeys.has(dedupeKey));
    });
}

export function buildPdfEpubComparisonAudit({
  pdfDoc,
  epubDoc,
  englishSource = null,
  glossary = {},
  epubTarget = null,
  existingQueue = null,
} = {}) {
  const pdfByChapter = indexSectionsByChapter(pdfDoc);
  const epubByChapter = indexSectionsByChapter(epubDoc);
  const chapterTitles = buildChapterTitleMap({ pdfByChapter, epubByChapter, englishSource });
  const detectedFindings = [
    ...detectCoverageFindings(pdfByChapter, epubByChapter, epubDoc),
    ...detectTitleFindings(pdfByChapter, epubByChapter),
    ...detectTerminologyFindings(pdfDoc, epubDoc, glossary),
    ...detectResidualLanguageFindings(epubDoc),
    ...detectCharacterFindings(epubDoc, glossary, { englishSource }),
    ...detectMeaningFindings(epubDoc),
  ].map((finding) => enrichFindingWithChapterTitle(finding, chapterTitles));
  const carriedOverFindings = carryOverPendingFindings(existingQueue, detectedFindings)
    .map((finding) => enrichFindingWithChapterTitle(finding, chapterTitles));
  const findings = sortFindings(dedupeFindings([...detectedFindings, ...carriedOverFindings]));
  const categories = buildGroupedCategories(findings);

  return {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    inputs: auditInputs(pdfDoc, epubDoc, epubTarget),
    englishSource,
    summary: {
      totalFindings: findings.length,
      detectedFindings: detectedFindings.length,
      carriedOverPendingFindings: carriedOverFindings.length,
      categories: Object.fromEntries(categories.map((item) => [item.id, item.count])),
      pdfChapters: pdfByChapter.size,
      epubChapters: epubByChapter.size,
      taxonomy: 'pdf_epub_editorial_groups_v1',
    },
    categories,
  };
}
