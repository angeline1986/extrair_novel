import path from 'path';
import { writeJsonReport } from '../utils/report-writer.js';
import { analyzeStructure } from '../analyzers/structure-analyzer.js';
import { validateEpub3 } from '../validators/epub3-validator.js';
import { validateChapterSequence } from '../analyzers/chapter-sequence-validator.js';
import { preparePipelineContext } from './context.js';
import { analyzeAndSelectChapterReport } from './source-analysis.js';
import { prepareResplitPrecheck, runResplit } from './resplit.js';
import { buildStructuredOutput } from './build-output.js';
import { runFinalAnalysis } from './final-analysis.js';
import { createReportContext, finishReportContext } from '../utils/report-context.js';

export async function runFullPipeline(root, options = {}) {
  const { log = () => {}, argv = process.argv.slice(2), epubPath = null } = options;
  const context = await preparePipelineContext(root, { argv, log, epubPath });
  const { cliOptions, inputFile, pdfFile } = context;
  const reportContext = options.reportContext || await createReportContext({
    root,
    operation: 'full_pipeline',
    operationLabel: 'Processamento completo',
    inputs: [inputFile]
  });
  const reportsDir = reportContext.dataDir;
  const sourceAnalysis = await analyzeAndSelectChapterReport(context, { log });
  const {
    epub,
    htmlDocs,
    tocReport,
    languageReport,
    pdfTocReport,
    spineChapterReport,
    overrideResult,
    internalChapterReport,
    chapterSourceDecision,
    chapterReport
  } = sourceAnalysis;

  log('Analisando estrutura e validação inicial...');
  const structureReport = analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport);
  const validationReport = validateEpub3(structureReport, chapterReport, tocReport, languageReport);

  const { boundaryReport, resplitPrecheckReport } = prepareResplitPrecheck({ epub, chapterReport, chapterSourceDecision });
  const sourceIdentityReport = buildSourceIdentityReport({ inputFile, pdfFile, pdfTocReport, cliOptions });
  const sourceQualityReport = buildSourceQualityReport(chapterSourceDecision.candidates || []);

  await writeJsonReport(path.join(reportsDir, 'internal_chapter_report.json'), internalChapterReport);
  await writeJsonReport(path.join(reportsDir, 'book_structure_override_report.json'), overrideResult.report);
  await writeJsonReport(path.join(reportsDir, 'final_chapter_sequence_report.json'), buildFinalChapterSequenceReport(internalChapterReport));
  await writeJsonReport(path.join(reportsDir, 'teaser_extraction_report.json'), buildTeaserExtractionReport(overrideResult.teaserRange));
  await writeJsonReport(path.join(reportsDir, 'irregular_chapter_report.json'), buildIrregularChapterReport(overrideResult.report));
  await writeJsonReport(path.join(reportsDir, 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_report.json'), chapterSourceDecision);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_candidates.json'), chapterSourceDecision.candidates || []);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_identity.json'), sourceIdentityReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_quality.json'), sourceQualityReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_source_decision.json'), chapterSourceDecision);
  await writeJsonReport(path.join(reportsDir, 'boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(reportsDir, 'chapter_boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(reportsDir, 'resplit_precheck_report.json'), resplitPrecheckReport);

  const { rangeReport, chaptersDir, resplitReport } = runResplit({
    root,
    epub,
    chapterReport,
    boundaryReport,
    chapterSourceDecision,
    teaserRange: overrideResult.teaserRange
  }, { log });

  const { outputFile } = buildStructuredOutput({
    root,
    inputFile,
    epub,
    chapterReport,
    resplitReport,
    chaptersDir
  }, { log });

  const finalAnalysis = await runFinalAnalysis({
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
  }, { log });

  log('EPUB processado pela v7.2 PDF canonical.');
  log(`Entrada: ${path.relative(root, inputFile)}`);
  if (pdfFile) log(`PDF: ${path.relative(root, pdfFile)}`);
  log(`Saída: ${path.relative(root, outputFile)}`);
  await finishReportContext(reportContext, { status: 'success', output: outputFile });

  return {
    context,
    reportContext,
    sourceAnalysis,
    initialAnalysis: {
      structureReport,
      validationReport,
      boundaryReport,
      resplitPrecheckReport,
      sourceIdentityReport,
      sourceQualityReport
    },
    resplit: {
      rangeReport,
      chaptersDir,
      resplitReport
    },
    outputFile,
    finalAnalysis
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
