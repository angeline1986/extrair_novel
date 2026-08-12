import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { writeJsonReport } from '../utils/report-writer.js';
import { readEpub } from '../parsers/epub-reader.js';
import { readHtmlDocuments } from '../parsers/html-reader.js';
import { analyzeToc } from '../analyzers/toc-analyzer.js';
import { analyzeStructure } from '../analyzers/structure-analyzer.js';
import { validateEpub3 } from '../validators/epub3-validator.js';
import { runFinalRegressionValidation } from '../validators/final-regression-validator.js';
import { buildValidationBaseline, writeValidationBaseline } from '../validators/validation-baseline.js';
import { auditFinalEpub } from '../validators/final-epub-auditor.js';
import { readZipText } from '../utils/zip-utils.js';
import {
  extractBodyFragmentByRange,
  extractBodyFragmentFromBoundaryToEnd,
  extractBodyFragmentFromStartToBoundary,
  extractWholeBodyFragment,
  wordCountFromXhtml
} from '../utils/dom-range-extractor.js';
import { validateChapterSequence } from '../analyzers/chapter-sequence-validator.js';

export async function runFinalAnalysis(pipeline, options = {}) {
  const { log = () => {} } = options;
  const {
    root,
    inputFile,
    outputFile,
    epub,
    languageReport,
    chapterReport,
    spineChapterReport,
    internalChapterReport,
    overrideResult,
    pdfTocReport,
    chapterSourceDecision,
    sourceIdentityReport,
    sourceQualityReport,
    boundaryReport,
    rangeReport,
    resplitReport,
    chaptersDir,
    reportContext
  } = pipeline;
  const reportsDir = reportContext?.dataDir || path.join(root, 'reports');

  const updatedChapterReport = updateChapterReportHrefs(chapterReport, resplitReport);

  log('Reanalisando EPUB final...');
  const finalEpub = readEpub(outputFile);
  const finalHtmlDocs = readHtmlDocuments(finalEpub);
  const finalTocReport = analyzeToc(finalEpub);
  const finalStructureReport = analyzeStructure(finalEpub, finalHtmlDocs, updatedChapterReport, finalTocReport, languageReport);
  const finalValidationReport = validateEpub3(finalStructureReport, updatedChapterReport, finalTocReport, languageReport);

  log('Gravando relatórios finais...');
  await writeJsonReport(path.join(reportsDir, 'structure_report.json'), finalStructureReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_report.json'), chapterReport);
  await writeJsonReport(path.join(reportsDir, 'spine_chapter_report.json'), spineChapterReport);
  await writeJsonReport(path.join(reportsDir, 'internal_chapter_report.json'), internalChapterReport);
  await writeJsonReport(path.join(reportsDir, 'book_structure_override_report.json'), overrideResult.report);
  await writeJsonReport(path.join(reportsDir, 'final_chapter_sequence_report.json'), buildFinalChapterSequenceReport(internalChapterReport));
  await writeJsonReport(path.join(reportsDir, 'teaser_extraction_report.json'), buildTeaserExtractionReport(overrideResult.teaserRange, resplitReport));
  await writeJsonReport(path.join(reportsDir, 'irregular_chapter_report.json'), buildIrregularChapterReport(overrideResult.report));
  await writeJsonReport(path.join(reportsDir, 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_report.json'), chapterSourceDecision);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_candidates.json'), chapterSourceDecision.candidates || []);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_identity.json'), sourceIdentityReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_quality.json'), sourceQualityReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_decision.json'), chapterSourceDecision);
  await writeJsonReport(path.join(reportsDir, 'toc_report.json'), finalTocReport);
  await writeJsonReport(path.join(reportsDir, 'language_report.json'), languageReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_range_report.json'), rangeReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_resplit_report.json'), resplitReport);
  await writeJsonReport(path.join(reportsDir, 'validation_report.json'), finalValidationReport);

  const validationBaseline = buildValidationBaseline({ root, inputFile, chapterReport, resplitReport });
  const validationBaselinePath = await writeValidationBaseline(root, validationBaseline);

  log('Executando validação final de regressão...');
  const finalRegressionReport = runFinalRegressionValidation(reportsDir, outputFile, {
    baselinePath: validationBaselinePath
  });
  await writeJsonReport(path.join(reportsDir, 'final_regression_report.json'), finalRegressionReport);

  log('Auditando pacote EPUB final...');
  const finalEpubAudit = auditFinalEpub(outputFile);
  const chapterContentAudit = buildChapterContentAudit({ epub, rangeReport, chaptersDir, resplitReport });
  await writeJsonReport(path.join(reportsDir, 'epub_packaging_audit.json'), finalEpubAudit.packaging);
  await writeJsonReport(path.join(reportsDir, 'xml_validation_report.json'), finalEpubAudit.xmlValidation);
  await writeJsonReport(path.join(reportsDir, 'nav_namespace_report.json'), finalEpubAudit.navNamespace);
  await writeJsonReport(path.join(reportsDir, 'chapter_content_audit.json'), chapterContentAudit);
  await writeJsonReport(path.join(reportsDir, 'language_audit.json'), finalEpubAudit.language);
  await writeJsonReport(path.join(reportsDir, 'heading_cleanup_report.json'), finalEpubAudit.headings);
  await writeJsonReport(path.join(reportsDir, 'heading_consistency_report.json'), finalEpubAudit.headings);
  await writeJsonReport(path.join(reportsDir, 'residual_marker_report.json'), finalEpubAudit.residualMarkers);
  await writeJsonReport(path.join(reportsDir, 'orphan_files_report.json'), finalEpubAudit.orphans);
  await writeJsonReport(path.join(reportsDir, 'final_epub_validation.json'), finalEpubAudit.validation);
  if (!finalEpubAudit.validation.ok) {
    throw new Error('Auditoria final do EPUB falhou. Consulte reports/final_epub_validation.json.');
  }

  return {
    updatedChapterReport,
    finalEpub,
    finalHtmlDocs,
    finalTocReport,
    finalStructureReport,
    finalValidationReport,
    finalRegressionReport,
    finalEpubAudit,
    chapterContentAudit
  };
}

function updateChapterReportHrefs(chapterReport, resplitReport) {
  const hrefMap = new Map();
  for (const resplitChapter of resplitReport.chapters) {
    hrefMap.set(resplitChapter.chapterNumber, resplitChapter.outputFile);
  }
  const updatedChapters = chapterReport.chapters.map(chapter => {
    if (chapter.role === 'chapter' && chapter.chapterNumber) {
      const newHref = hrefMap.get(chapter.chapterNumber);
      if (newHref) {
        return { ...chapter, href: newHref, fullPath: newHref };
      }
    }
    return chapter;
  });
  return { ...chapterReport, chapters: updatedChapters };
}

function buildFinalChapterSequenceReport(chapterReport) {
  const sequence = validateChapterSequence(chapterReport.chapters || []);
  const numbers = sequence.detectedNumbers || [];
  return {
    generatedAt: new Date().toISOString(),
    chapterCount: numbers.length,
    firstChapterNumber: numbers[0] || null,
    lastChapterNumber: numbers.at(-1) || null,
    missingChapters: sequence.missingChapters,
    duplicateChapters: sequence.duplicateChapters,
    outOfOrderChapters: sequence.outOfOrderChapters
  };
}

function buildTeaserExtractionReport(teaserRange, resplitReport = null) {
  const item = resplitReport?.supplementalItems?.find((candidate) => candidate.role === 'teaser') || null;
  return {
    generatedAt: new Date().toISOString(),
    teaserPreserved: Boolean(teaserRange),
    range: teaserRange,
    outputFile: item?.outputFile || teaserRange?.outputFile || null,
    wordCount: item?.wordCount || null,
    ok: item ? item.ok : Boolean(teaserRange)
  };
}

function buildIrregularChapterReport(overrideReport) {
  return {
    generatedAt: new Date().toISOString(),
    addedIrregularChapters: overrideReport.addedIrregularChapters || [],
    chapters: (overrideReport.chapters || []).filter((chapter) => chapter.kind === 'irregular')
  };
}

function buildChapterContentAudit({ epub, rangeReport, chaptersDir, resplitReport }) {
  const targetNumbers = [83, 456, 457];
  const chapters = targetNumbers.map((chapterNumber) => {
    const range = rangeReport.ranges.find((candidate) => candidate.chapterNumber === chapterNumber);
    const generated = resplitReport.chapters.find((candidate) => candidate.chapterNumber === chapterNumber);
    const generatedPath = path.join(chaptersDir, generated?.outputFile || `chapter_${String(chapterNumber).padStart(3, '0')}.xhtml`);
    const generatedXhtml = readTextIfExists(generatedPath);
    const generatedStats = summarizeXhtml(generatedXhtml);
    const originalFragment = range ? extractOriginalRangeFragment(epub, range) : '';
    const originalStats = summarizeXhtml(`<html><body>${originalFragment}</body></html>`);
    return {
      chapterNumber,
      wordCount: generatedStats.wordCount,
      nodeCount: generatedStats.nodeCount,
      firstParagraph: generatedStats.firstParagraph,
      lastParagraph: generatedStats.lastParagraph,
      startsWith: generatedStats.startsWith,
      endsWith: generatedStats.endsWith,
      sourceHref: range?.startFile || null,
      startDomPath: range?.startDomPath || null,
      endDomPath: range?.endDomPath || null,
      extractedNodeCount: originalStats.nodeCount,
      originalWordCount: originalStats.wordCount,
      generatedWordCount: generatedStats.wordCount,
      wordDifference: originalStats.wordCount - generatedStats.wordCount,
      generatedOk: generated?.ok || false,
      previousChapter: chapterNumber - 1,
      nextChapter: chapterNumber + 1,
      generatedRange: range || null,
      chaptersWithMissingBody: generatedStats.wordCount < 100 && originalStats.wordCount >= 100
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    chapters,
    chaptersWithMissingBody: chapters.filter((chapter) => chapter.chaptersWithMissingBody).map((chapter) => chapter.chapterNumber),
    chaptersBelow100Words: chapters.filter((chapter) => chapter.wordCount < 100).map((chapter) => chapter.chapterNumber)
  };
}

function extractOriginalRangeFragment(epub, range) {
  if (range.startFile !== range.endFile) return extractOriginalMultiFileRange(epub, range);
  const file = epub.spineItems.find((item) => item.href === range.startFile);
  if (!file) return '';
  const html = readZipText(epub.zip, file.fullPath);
  if (range.endDomPath) return extractBodyFragmentByRange(html, range.startDomPath, range.endDomPath);
  return extractBodyFragmentFromBoundaryToEnd(html, range.startDomPath);
}

function extractOriginalMultiFileRange(epub, range) {
  const parts = [];
  const startFile = epub.spineItems.find((item) => item.href === range.startFile);
  const startHtml = readZipText(epub.zip, startFile.fullPath);
  parts.push(extractBodyFragmentFromBoundaryToEnd(startHtml, range.startDomPath));
  for (const fileInfo of range.files || []) {
    if (fileInfo.href === range.startFile || fileInfo.href === range.endFile) continue;
    const file = epub.spineItems.find((item) => item.href === fileInfo.href);
    if (!file) continue;
    parts.push(extractWholeBodyFragment(readZipText(epub.zip, file.fullPath)));
  }
  if (range.endDomPath && range.endFile !== range.startFile) {
    const endFile = epub.spineItems.find((item) => item.href === range.endFile);
    const endHtml = readZipText(epub.zip, endFile.fullPath);
    try {
      parts.push(extractBodyFragmentFromStartToBoundary(endHtml, range.endDomPath));
    } catch (error) {
      if (!String(error?.message || '').startsWith('EMPTY_EXTRACTED_RANGE:')) throw error;
    }
  }
  return parts.join('\n');
}

function summarizeXhtml(xhtml) {
  if (!xhtml) return { wordCount: 0, nodeCount: 0, firstParagraph: '', lastParagraph: '', startsWith: '', endsWith: '' };
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  const paragraphs = $('body').find('p,h1,h2,h3,h4,li').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return {
    wordCount: wordCountFromXhtml(xhtml),
    nodeCount: $('body').find('*').length,
    firstParagraph: paragraphs[0] || '',
    lastParagraph: paragraphs.at(-1) || '',
    startsWith: text.slice(0, 180),
    endsWith: text.slice(-180)
  };
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}
