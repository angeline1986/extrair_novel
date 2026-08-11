import path from 'path';
import fs from 'fs';
import { findSingleEpub, resolveOptionalPdf, ensureWorkflowDirs, parseCliOptions } from './utils/file-utils.js';
import { safeFileName } from './utils/text-utils.js';
import { writeJsonReport } from './utils/report-writer.js';
import { readEpub } from './parsers/epub-reader.js';
import { readHtmlDocuments } from './parsers/html-reader.js';
import { analyzeToc } from './analyzers/toc-analyzer.js';
import { detectLanguage } from './analyzers/language-detector.js';
import { detectChapters } from './analyzers/chapter-detector.js';
import { analyzeStructure } from './analyzers/structure-analyzer.js';
import { extractPdfCanonicalChapters } from './analyzers/pdf-toc-extractor.js';
import { validateEpub3 } from './validators/epub3-validator.js';
import { runFinalRegressionValidation } from './validators/final-regression-validator.js';
import { auditFinalEpub } from './validators/final-epub-auditor.js';
import { readZipText } from './utils/zip-utils.js';
import {
  extractBodyFragmentByRange,
  extractBodyFragmentFromBoundaryToEnd,
  extractBodyFragmentFromStartToBoundary,
  extractWholeBodyFragment,
  wordCountFromXhtml
} from './utils/dom-range-extractor.js';
import * as cheerio from 'cheerio';
import { buildStructuredEpub } from './builders/epub-builder.js';
import { analyzeChapterBoundaries } from './analyzers/chapter-boundary-analyzer.js';
import { buildChapterRanges } from './analyzers/chapter-range-builder.js';
import { performCanonicalResplit } from './segmenters/canonical-resplitter.js';
import { detectInternalChapters } from './analyzers/internal-chapter-discovery.js';
import { chooseChapterReport } from './utils/chapter-source.js';
import { applyBookStructureOverrides } from './utils/book-structure-overrides.js';
import { validateChapterSequence } from './analyzers/chapter-sequence-validator.js';

const ROOT = process.cwd();

async function main() {
  const cliOptions = parseCliOptions();
  console.log('Iniciando EPUB structuring workflow...');

  console.log('Preparando diretórios...');
  await ensureWorkflowDirs(ROOT);
  const inputDir = path.join(ROOT, 'input');
  const inputFile = await findSingleEpub(inputDir);
  const pdfFile = await resolveOptionalPdf(inputDir, cliOptions);
  console.log(`EPUB encontrado: ${path.relative(ROOT, inputFile)}`);
  if (cliOptions.noPdf) console.log('PDF desativado por --no-pdf.');
  if (pdfFile) console.log(`PDF selecionado: ${path.relative(ROOT, pdfFile)}`);

  console.log('Lendo EPUB e documentos HTML...');
  const epub = readEpub(inputFile);
  const htmlDocs = readHtmlDocuments(epub);
  console.log(`HTMLs no spine/manifest: ${htmlDocs.length}`);

  console.log('Analisando TOC, idioma e PDF opcional...');
  const tocReport = analyzeToc(epub);
  const languageReport = detectLanguage(epub, htmlDocs);
  const pdfTocReport = await extractPdfCanonicalChapters(pdfFile, epub);
  console.log(`TOC: ${tocReport.entryCount || tocReport.entries?.length || 0} entradas; PDF capítulos: ${pdfTocReport.chapterCount}`);

  console.log('Detectando capítulos por spine e por DOM interno...');
  const spineChapterReport = detectChapters(epub, htmlDocs, tocReport, pdfTocReport);
  const rawInternalChapterReport = detectInternalChapters(epub, htmlDocs);
  const overrideResult = applyBookStructureOverrides(epub, rawInternalChapterReport);
  const internalChapterReport = overrideResult.chapterReport;
  console.log(`Spine/canonical: ${spineChapterReport.chapterCount} capítulos; internal-dom: ${rawInternalChapterReport.chapterCount} capítulos; após override: ${internalChapterReport.chapterCount}.`);

  console.log('Medindo cobertura de boundaries antes de escolher a fonte...');
  const spineBoundaryReport = analyzeChapterBoundaries(epub, spineChapterReport);
  const internalBoundaryReport = analyzeChapterBoundaries(epub, internalChapterReport);
  console.log(`Cobertura spine/canonical: ${spineBoundaryReport.foundCount}/${spineBoundaryReport.expectedCount}; internal-dom: ${internalBoundaryReport.foundCount}/${internalBoundaryReport.expectedCount}.`);

  console.log('Escolhendo fonte de capítulos...');
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
  console.log(`Fonte escolhida: ${chapterSourceDecision.source} (${chapterSourceDecision.reason}).`);

  const chapterReport = chapterSourceDecision.chapterReport;
  console.log('Analisando estrutura e validação inicial...');
  const structureReport = analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport);
  const validationReport = validateEpub3(structureReport, chapterReport, tocReport, languageReport);
  
  // Analisar limites reais dos capítulos no DOM (diagnóstico)
  const boundaryReport = chapterSourceDecision.boundaryReport || analyzeChapterBoundaries(epub, chapterReport);
  const resplitPrecheckReport = buildResplitPrecheckReport({ chapterReport, boundaryReport, chapterSourceDecision });
  const sourceIdentityReport = buildSourceIdentityReport({ inputFile, pdfFile, pdfTocReport, cliOptions });
  const sourceQualityReport = buildSourceQualityReport(chapterSourceDecision.candidates || []);
  await writeJsonReport(path.join(ROOT, 'reports', 'internal_chapter_report.json'), internalChapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'book_structure_override_report.json'), overrideResult.report);
  await writeJsonReport(path.join(ROOT, 'reports', 'final_chapter_sequence_report.json'), buildFinalChapterSequenceReport(internalChapterReport));
  await writeJsonReport(path.join(ROOT, 'reports', 'teaser_extraction_report.json'), buildTeaserExtractionReport(overrideResult.teaserRange));
  await writeJsonReport(path.join(ROOT, 'reports', 'irregular_chapter_report.json'), buildIrregularChapterReport(overrideResult.report));
  await writeJsonReport(path.join(ROOT, 'reports', 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_report.json'), chapterSourceDecision);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_candidates.json'), chapterSourceDecision.candidates || []);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_identity.json'), sourceIdentityReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_quality.json'), sourceQualityReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_decision.json'), chapterSourceDecision);
  await writeJsonReport(path.join(ROOT, 'reports', 'boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'resplit_precheck_report.json'), resplitPrecheckReport);
  assertSafeForResplit({ chapterReport, boundaryReport, chapterSourceDecision });
  
  // Construir ranges reais dos capítulos a partir dos boundaries
  console.log('Construindo ranges de capítulos...');
  const rangeReport = buildChapterRanges(boundaryReport, epub);
  if (overrideResult.teaserRange && chapterSourceDecision.source === 'internal-dom') {
    rangeReport.supplementalRanges = [overrideResult.teaserRange];
  }
  console.log(`Ranges construídos: ${rangeReport.rangeCount}`);
  
  // Realizar resplit canônico dos capítulos
  console.log('Executando resplit dos capítulos...');
  const chaptersDir = path.join(ROOT, 'output', 'chapters');
  const resplitReport = performCanonicalResplit(rangeReport, boundaryReport, epub, chaptersDir);
  if (resplitReport.ok !== true) {
    throw new Error(`Resplit inseguro: ${resplitReport.chapterCount}/${rangeReport.rangeCount} capítulos gerados corretamente.`);
  }
  console.log(`Resplit concluído: ${resplitReport.chapterCount} capítulos gerados.`);
  
  const bookName = safeFileName(epub.opf.metadata.title || path.basename(inputFile, '.epub'));
  const outputFile = path.join(ROOT, 'output', `${bookName}-structured-complete.epub`);

  console.log('Empacotando EPUB estruturado...');
  buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile);

  // Atualizar chapterReport com novos hrefs para reanálise
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
  const updatedChapterReport = { ...chapterReport, chapters: updatedChapters };

  // Reanalisar EPUB final estruturado completamente
  console.log('Reanalisando EPUB final...');
  const finalEpub = readEpub(outputFile);
  const finalHtmlDocs = readHtmlDocuments(finalEpub);
  const finalTocReport = analyzeToc(finalEpub);
  const finalStructureReport = analyzeStructure(finalEpub, finalHtmlDocs, updatedChapterReport, finalTocReport, languageReport);
  const finalValidationReport = validateEpub3(finalStructureReport, updatedChapterReport, finalTocReport, languageReport);

  console.log('Gravando relatórios finais...');
  await writeJsonReport(path.join(ROOT, 'reports', 'structure_report.json'), finalStructureReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_report.json'), chapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'spine_chapter_report.json'), spineChapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'internal_chapter_report.json'), internalChapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'book_structure_override_report.json'), overrideResult.report);
  await writeJsonReport(path.join(ROOT, 'reports', 'final_chapter_sequence_report.json'), buildFinalChapterSequenceReport(internalChapterReport));
  await writeJsonReport(path.join(ROOT, 'reports', 'teaser_extraction_report.json'), buildTeaserExtractionReport(overrideResult.teaserRange, resplitReport));
  await writeJsonReport(path.join(ROOT, 'reports', 'irregular_chapter_report.json'), buildIrregularChapterReport(overrideResult.report));
  await writeJsonReport(path.join(ROOT, 'reports', 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_report.json'), chapterSourceDecision);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_candidates.json'), chapterSourceDecision.candidates || []);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_identity.json'), sourceIdentityReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_quality.json'), sourceQualityReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_source_decision.json'), chapterSourceDecision);
  await writeJsonReport(path.join(ROOT, 'reports', 'toc_report.json'), finalTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'language_report.json'), languageReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_range_report.json'), rangeReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_resplit_report.json'), resplitReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'validation_report.json'), finalValidationReport);

  // Validação final de regressão
  console.log('Executando validação final de regressão...');
  const finalRegressionReport = runFinalRegressionValidation(path.join(ROOT, 'reports'), outputFile);
  await writeJsonReport(path.join(ROOT, 'reports', 'final_regression_report.json'), finalRegressionReport);

  console.log('Auditando pacote EPUB final...');
  const finalEpubAudit = auditFinalEpub(outputFile);
  const chapterContentAudit = buildChapterContentAudit({ epub, rangeReport, chaptersDir, resplitReport });
  await writeJsonReport(path.join(ROOT, 'reports', 'epub_packaging_audit.json'), finalEpubAudit.packaging);
  await writeJsonReport(path.join(ROOT, 'reports', 'xml_validation_report.json'), finalEpubAudit.xmlValidation);
  await writeJsonReport(path.join(ROOT, 'reports', 'nav_namespace_report.json'), finalEpubAudit.navNamespace);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_content_audit.json'), chapterContentAudit);
  await writeJsonReport(path.join(ROOT, 'reports', 'language_audit.json'), finalEpubAudit.language);
  await writeJsonReport(path.join(ROOT, 'reports', 'heading_cleanup_report.json'), finalEpubAudit.headings);
  await writeJsonReport(path.join(ROOT, 'reports', 'heading_consistency_report.json'), finalEpubAudit.headings);
  await writeJsonReport(path.join(ROOT, 'reports', 'residual_marker_report.json'), finalEpubAudit.residualMarkers);
  await writeJsonReport(path.join(ROOT, 'reports', 'orphan_files_report.json'), finalEpubAudit.orphans);
  await writeJsonReport(path.join(ROOT, 'reports', 'final_epub_validation.json'), finalEpubAudit.validation);
  if (!finalEpubAudit.validation.ok) {
    throw new Error('Auditoria final do EPUB falhou. Consulte reports/final_epub_validation.json.');
  }

  console.log('EPUB processado pela v7.2 PDF canonical.');
  console.log(`Entrada: ${path.relative(ROOT, inputFile)}`);
  if (pdfFile) console.log(`PDF: ${path.relative(ROOT, pdfFile)}`);
  console.log(`Saída: ${path.relative(ROOT, outputFile)}`);
}

function assertSafeForResplit({ chapterReport, boundaryReport, chapterSourceDecision }) {
  const reportHint = 'Consulte reports/internal_chapter_report.json, reports/chapter_source_report.json, reports/boundary_report.json e reports/resplit_precheck_report.json.';
  if (!chapterReport?.chapters?.length) {
    throw new Error(`Resplit bloqueado: nenhum capítulo foi selecionado. ${reportHint}`);
  }
  if (chapterSourceDecision.source === 'internal-dom') {
    const conflicts = chapterReport.diagnostics?.conflicts?.length || 0;
    const averageConfidence = chapterReport.diagnostics?.confidenceSummary?.averageConfidence || 0;
    if (conflicts > 0) throw new Error(`Resplit bloqueado: ${conflicts} conflitos fortes na descoberta interna. ${reportHint}`);
    if (averageConfidence < 0.65) throw new Error(`Resplit bloqueado: confiança média interna ${averageConfidence} abaixo da política. ${reportHint}`);
  }

  const expected = boundaryReport.expectedCount || chapterReport.chapters.length;
  const found = boundaryReport.foundCount || 0;
  const coverage = expected ? found / expected : 0;
  if (coverage < 1) {
    throw new Error(`Resplit bloqueado: cobertura de boundaries ${(coverage * 100).toFixed(2)}% (${found}/${expected}). ${reportHint}`);
  }
}

function buildResplitPrecheckReport({ chapterReport, boundaryReport, chapterSourceDecision }) {
  const expected = boundaryReport.expectedCount || chapterReport.chapters?.length || 0;
  const found = boundaryReport.foundCount || 0;
  const boundaryCoverage = expected ? found / expected : 0;
  return {
    generatedAt: new Date().toISOString(),
    ok: Boolean(chapterReport.chapters?.length) && boundaryCoverage >= 1,
    selectedSource: chapterSourceDecision.source,
    selectedReason: chapterSourceDecision.reason,
    expectedChapterCount: expected,
    locatedBoundaryCount: found,
    boundaryCoverage,
    blockingIssues: [
      ...(!chapterReport.chapters?.length ? [{ code: 'NO_SELECTED_CHAPTERS' }] : []),
      ...(boundaryCoverage < 1 ? [{ code: 'BOUNDARY_COVERAGE_BELOW_POLICY', expectedChapterCount: expected, locatedBoundaryCount: found, boundaryCoverage }] : [])
    ],
    reportFiles: [
      'reports/internal_chapter_report.json',
      'reports/chapter_source_report.json',
      'reports/boundary_report.json',
      'reports/resplit_precheck_report.json'
    ]
  };
}

function buildSourceIdentityReport({ inputFile, pdfFile, pdfTocReport, cliOptions }) {
  return {
    generatedAt: new Date().toISOString(),
    epubPath: inputFile,
    pdfPath: pdfFile,
    pdfDisabledByCli: Boolean(cliOptions.noPdf),
    explicitPdfPath: cliOptions.pdfPath || null,
    canonicalBookId: pdfTocReport.canonicalBookId,
    mapSource: pdfTocReport.mapSource,
    extractedPdfChapterCount: pdfTocReport.extractedPdfChapterCount || 0,
    extractedPdfTitles: pdfTocReport.extractedPdfTitles || [],
    knownCanonicalMatched: Boolean(pdfTocReport.knownCanonicalMatched),
    matchReason: pdfTocReport.matchReason,
    identityValid: Boolean(pdfTocReport.identityValid),
    identityEvidence: pdfTocReport.identityEvidence || []
  };
}

function buildSourceQualityReport(candidates) {
  return {
    generatedAt: new Date().toISOString(),
    candidates: candidates.map((candidate) => ({
      source: candidate.source,
      identityValid: candidate.identityValid,
      identityEvidence: candidate.identityEvidence,
      chapterCount: candidate.chapterCount,
      boundaryCoverage: candidate.boundaryCoverage,
      conflicts: candidate.conflicts,
      duplicates: candidate.duplicates,
      sequenceValid: candidate.sequenceValid,
      accepted: candidate.accepted,
      rejectionReasons: candidate.rejectionReasons
    }))
  };
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

main().catch((error) => {
  console.error('Falha ao executar workflow.');
  console.error(error.message);
  process.exit(1);
});
