import { readEpub } from '../parsers/epub-reader.js';
import { readHtmlDocuments } from '../parsers/html-reader.js';
import { analyzeToc } from '../analyzers/toc-analyzer.js';
import { detectLanguage } from '../analyzers/language-detector.js';
import { detectChapters } from '../analyzers/chapter-detector.js';
import { extractPdfCanonicalChapters } from '../analyzers/pdf-toc-extractor.js';
import { analyzeChapterBoundaries } from '../analyzers/chapter-boundary-analyzer.js';
import { detectInternalChapters } from '../analyzers/internal-chapter-discovery.js';
import { chooseChapterReport } from '../utils/chapter-source.js';
import { applyBookStructureOverrides } from '../utils/book-structure-overrides.js';

export async function analyzeAndSelectChapterReport(context, options = {}) {
  const { cliOptions, inputFile, pdfFile } = context;
  const { log = () => {} } = options;

  log('Lendo EPUB e documentos HTML...');
  const epub = readEpub(inputFile);
  const htmlDocs = readHtmlDocuments(epub);
  log(`HTMLs no spine/manifest: ${htmlDocs.length}`);

  log('Analisando TOC, idioma e PDF opcional...');
  const tocReport = analyzeToc(epub);
  const languageReport = detectLanguage(epub, htmlDocs);
  const pdfTocReport = await extractPdfCanonicalChapters(pdfFile, epub);
  log(`TOC: ${tocReport.entryCount || tocReport.entries?.length || 0} entradas; PDF capítulos: ${pdfTocReport.chapterCount}`);

  log('Detectando capítulos por spine e por DOM interno...');
  const spineChapterReport = detectChapters(epub, htmlDocs, tocReport, pdfTocReport);
  const rawInternalChapterReport = detectInternalChapters(epub, htmlDocs);
  const overrideResult = applyBookStructureOverrides(epub, rawInternalChapterReport);
  const internalChapterReport = overrideResult.chapterReport;
  log(`Spine/canonical: ${spineChapterReport.chapterCount} capítulos; internal-dom: ${rawInternalChapterReport.chapterCount} capítulos; após override: ${internalChapterReport.chapterCount}.`);

  log('Medindo cobertura de boundaries antes de escolher a fonte...');
  const spineBoundaryReport = analyzeChapterBoundaries(epub, spineChapterReport);
  const internalBoundaryReport = analyzeChapterBoundaries(epub, internalChapterReport);
  log(`Cobertura spine/canonical: ${spineBoundaryReport.foundCount}/${spineBoundaryReport.expectedCount}; internal-dom: ${internalBoundaryReport.foundCount}/${internalBoundaryReport.expectedCount}.`);

  log('Escolhendo fonte de capítulos...');
  const chapterSourceDecision = chooseChapterReport({
    pdfCanonicalReport: pdfTocReport,
    internalChapterReport,
    spineChapterReport,
    tocReport,
    htmlCount: htmlDocs.length,
    boundaryReports: {
      spine: spineBoundaryReport,
      canonical: spineBoundaryReport,
      internal: internalBoundaryReport
    },
    pdfOptions: cliOptions
  });
  log(`Fonte escolhida: ${chapterSourceDecision.source} (${chapterSourceDecision.reason}).`);

  return {
    epub,
    htmlDocs,
    tocReport,
    languageReport,
    pdfTocReport,
    spineChapterReport,
    rawInternalChapterReport,
    overrideResult,
    internalChapterReport,
    spineBoundaryReport,
    internalBoundaryReport,
    chapterSourceDecision,
    chapterReport: chapterSourceDecision.chapterReport
  };
}
