import { buildGroupedCategories, sortFindings } from './taxonomy.js';
import { dedupeFindings } from './findingFactory.js';
import { dedupeKeyFromFinding, stableKeyFromFinding } from './reviewQueueKeys.js';
import { indexSectionsByChapter, stripChapterNumber, titleForSection } from './textUtils.js';
import { englishChapterTitleMap } from './englishSource.js';
import { buildPronounEvidenceIndex, evidenceForFinding } from './englishPronounEvidence.js';
import { detectCharacterFindings, feminineMarkersIn } from './detectors/characters.js';
import { detectCoverageFindings } from './detectors/coverage.js';
import { detectMeaningFindings } from './detectors/meaning.js';
import { detectResidualLanguageFindings } from './detectors/residualLanguage.js';
import { detectTerminologyFindings } from './detectors/terminology.js';
import { detectTitleFindings } from './detectors/titles.js';

function normalizeContext(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapedRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceOccurrence(text, from, to, occurrenceIndex = 0) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedRegex(from)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  let currentIndex = 0;
  return String(text || '').replace(pattern, (match, prefix) => {
    if (currentIndex++ !== occurrenceIndex) return match;
    return `${prefix}${to}`;
  });
}

function countTerm(text, term) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedRegex(term)}(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return [...String(text || '').matchAll(pattern)].length;
}

function resolvedContextIndex(existingQueue) {
  const groups = new Map();
  for (const item of existingQueue?.items || []) {
    const context = item.review?.scope?.context;
    if (!context || !['approved', 'rejected'].includes(item.status)) continue;
    if (!groups.has(context)) groups.set(context, []);
    groups.get(context).push(item);
  }

  const index = new Map();
  for (const [context, items] of groups.entries()) {
    const approved = items
      .filter((item) => item.status === 'approved' && item.review?.replacement)
      .sort((a, b) => Number(b.review.scope.occurrenceIndex || 0) - Number(a.review.scope.occurrenceIndex || 0));
    let finalContext = context;
    for (const item of approved) {
      finalContext = replaceOccurrence(
        finalContext,
        item.review.replacement.from,
        item.review.replacement.to,
        Number(item.review.scope.occurrenceIndex || 0)
      );
    }
    const keptCounts = new Map();
    for (const item of items.filter((entry) => entry.status === 'rejected')) {
      const term = String(item.problematicTerm || '').toLocaleLowerCase('pt-BR');
      if (term) keptCounts.set(term, (keptCounts.get(term) || 0) + 1);
    }
    index.set(normalizeContext(finalContext), { finalContext, keptCounts });
  }
  return index;
}

function resolvedFindingKeys(existingQueue) {
  const stableKeys = new Set();
  const dedupeKeys = new Set();
  for (const item of existingQueue?.items || []) {
    if (!['approved', 'rejected'].includes(item.status)) continue;
    if (item.stableKey) stableKeys.add(item.stableKey);
    if (item.dedupeKey) dedupeKeys.add(item.dedupeKey);
  }
  return { stableKeys, dedupeKeys };
}

function findingAlreadyResolved(finding, resolvedContexts, resolvedKeys) {
  const category = { id: finding.group };
  const stableKey = stableKeyFromFinding(category, finding);
  const dedupeKey = dedupeKeyFromFinding(category, finding);
  if (stableKey && resolvedKeys.stableKeys.has(stableKey)) return true;
  if (dedupeKey && resolvedKeys.dedupeKeys.has(dedupeKey)) return true;

  if (finding.group !== 'characters') return false;
  const context = finding.location || finding.translation;
  const resolved = resolvedContexts.get(normalizeContext(context));
  if (!resolved) return false;
  const markers = feminineMarkersIn(context);
  if (!markers.length) return false;
  return markers.every((marker) =>
    countTerm(context, marker) <= (resolved.keptCounts.get(marker.toLocaleLowerCase('pt-BR')) || 0)
  );
}

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

function pendingFindingFromQueueItem(item, pronounEvidenceIndex) {
  const group = item.categoryId || item.group || 'editorial';
  const decisionTerms = group === 'characters'
    ? [...new Set([
      item.problematicTerm,
      ...feminineMarkersIn(`${item.translation || ''} ${item.location || ''} ${item.problem || ''}`),
    ].filter(Boolean))]
    : [];
  const finding = {
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
  if (group !== 'characters') return finding;
  const englishEvidence = evidenceForFinding(finding, pronounEvidenceIndex);
  return {
    ...finding,
    englishEvidence,
    sourceValidation: {
      status: englishEvidence.status,
      confidence: englishEvidence.confidence,
      reason: englishEvidence.reason,
    },
    decisionSuggestions: englishEvidence.suggestions || [],
  };
}

function carryOverPendingFindings(existingQueue, currentFindings, pronounEvidenceIndex) {
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
    .map((item) => pendingFindingFromQueueItem(item, pronounEvidenceIndex))
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
  const pronounEvidenceIndex = buildPronounEvidenceIndex(epubDoc, englishSource);
  const rawDetectedFindings = [
    ...detectCoverageFindings(pdfByChapter, epubByChapter, epubDoc),
    ...detectTitleFindings(pdfByChapter, epubByChapter),
    ...detectTerminologyFindings(pdfDoc, epubDoc, glossary),
    ...detectResidualLanguageFindings(epubDoc),
    ...detectCharacterFindings(epubDoc, glossary, { englishSource }),
    ...detectMeaningFindings(epubDoc),
  ].map((finding) => enrichFindingWithChapterTitle(finding, chapterTitles));
  const resolvedContexts = resolvedContextIndex(existingQueue);
  const resolvedKeys = resolvedFindingKeys(existingQueue);
  const detectedFindings = rawDetectedFindings.filter((finding) =>
    !findingAlreadyResolved(finding, resolvedContexts, resolvedKeys)
  );
  const suppressedResolvedFindings = rawDetectedFindings.length - detectedFindings.length;
  const carriedOverFindings = carryOverPendingFindings(existingQueue, detectedFindings, pronounEvidenceIndex)
    .map((finding) => enrichFindingWithChapterTitle(finding, chapterTitles));
  const findings = sortFindings(dedupeFindings([...detectedFindings, ...carriedOverFindings]));
  const categories = buildGroupedCategories(findings);
  const decisionSuggestions = findings.flatMap((finding) => finding.decisionSuggestions || []);

  return {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    inputs: auditInputs(pdfDoc, epubDoc, epubTarget),
    englishSource,
    summary: {
      totalFindings: findings.length,
      detectedFindings: detectedFindings.length,
      suppressedResolvedFindings,
      carriedOverPendingFindings: carriedOverFindings.length,
      decisionSuggestions: {
        total: decisionSuggestions.length,
        highConfidence: decisionSuggestions.filter((item) => item.confidence === 'high').length,
        mediumConfidence: decisionSuggestions.filter((item) => item.confidence === 'medium').length,
        englishSupported: decisionSuggestions.filter((item) => String(item.source || '').startsWith('english_')).length,
        portugueseContext: decisionSuggestions.filter((item) => item.source === 'portuguese_coreference').length,
      },
      categories: Object.fromEntries(categories.map((item) => [item.id, item.count])),
      pdfChapters: pdfByChapter.size,
      epubChapters: epubByChapter.size,
      taxonomy: 'pdf_epub_editorial_groups_v1',
    },
    categories,
  };
}
