import fs from 'fs-extra';
import path from 'node:path';
import { analyzePrechapterBatch, applyPrechapterBatch } from '../prechapter/prechapter-batch.js';
import { writePrechapterBatchReport } from '../prechapter/prechapter-report.js';
import { buildMergePrecheck } from '../merge/merge-precheck.js';
import { writeMergePrecheckReport } from '../merge/merge-precheck-report.js';
import { mergeEpubs } from '../merge/epub-merge.js';
import { auditChapterIntegrity } from '../reference/chapter-integrity-auditor.js';
import { writeChapterIntegrityReport } from '../reference/chapter-integrity-report.js';
import { loadReferenceSource } from '../reference/reference-loader.js';
import { analyzeChapterTitles } from '../titles/chapter-title-analyzer.js';
import { normalizeChapterTitlesInCopy } from '../titles/chapter-title-fixer.js';
import { writeChapterTitleNormalizationReport } from '../titles/chapter-title-report.js';

export async function runCorrectAndMergeWorkflow(epubs, options = {}) {
  const root = options.root || process.cwd();
  const report = startReport(epubs);

  const analysisBatch = await analyzePrechapterBatch(epubs, root);
  report.steps.prechapterAnalysis = summarizeBatchStep(analysisBatch);
  await writePrechapterBatchReport(root, analysisBatch);

  const appliedBatch = await applyPrechapterBatch(analysisBatch, root);
  report.steps.prechapterApply = summarizeBatchStep(appliedBatch);
  await writePrechapterBatchReport(root, appliedBatch);

  const effective = resolveEffectiveSources(appliedBatch.items);
  report.effectiveSources = effective.sources;
  report.blockers = effective.blockers;
  if (effective.blockers.length) {
    return writeAndReturn(root, { ...report, status: 'blocked', blockedAt: 'effective-source-resolution' }, options.reportFile);
  }

  const precheck = buildMergePrecheck(effective.sources.map((source) => ({ path: source.effectivePath })));
  const precheckPath = await writeMergePrecheckReport(root, precheck);
  report.steps.mergePrecheck = { status: precheck.status, reportPath: path.relative(root, precheckPath), sourceCount: precheck.sourceCount, gaps: precheck.gaps.length, overlaps: precheck.overlaps.length, duplicates: precheck.duplicates.length };
  if (precheck.status !== 'ready_for_merge') {
    return writeAndReturn(root, { ...report, status: 'blocked', blockedAt: 'merge-precheck', precheckErrors: precheck.errors }, options.reportFile);
  }

  const mergeReport = mergeEpubs(precheck, { title: options.title, reportFile: path.join(root, 'reports', 'merge', 'merge_report.json') });
  report.steps.merge = { status: mergeReport.status, outputFile: mergeReport.outputFile, chapterCount: mergeReport.chapterCount, navigation: mergeReport.navigation, validationOk: mergeReport.validation.ok };
  if (mergeReport.status !== 'success' || !mergeReport.validation.ok) {
    return writeAndReturn(root, { ...report, status: 'failed', blockedAt: 'merge' }, options.reportFile);
  }

  const reference = options.referencePath ? await loadReferenceSource(options.referencePath) : null;
  const integrityReport = auditChapterIntegrity(mergeReport.outputFile, reference);
  const integrityPath = writeChapterIntegrityReport(root, integrityReport);
  report.steps.integrityAudit = { status: integrityReport.status, reportPath: path.relative(root, integrityPath), chapterCount: integrityReport.chapterCount, checkedChapters: integrityReport.checkedChapters, confidence: integrityReport.confidence, warnings: integrityReport.warnings.map((warning) => warning.code), errors: integrityReport.errors.length };
  if (integrityReport.status === 'FAILED' || integrityReport.status === 'REVIEW_REQUIRED') {
    return writeAndReturn(root, { ...report, status: 'blocked', blockedAt: 'integrity-audit', finalOutputFile: mergeReport.outputFile }, options.reportFile);
  }

  const titleAnalysis = analyzeChapterTitles(mergeReport.outputFile);
  report.steps.titleAnalysis = { status: titleAnalysis.status, chapterCount: titleAnalysis.chapterCount, changed: titleAnalysis.changed, unchanged: titleAnalysis.unchanged };
  let finalOutputFile = mergeReport.outputFile;
  if (options.normalizeTitles !== false && titleAnalysis.changed > 0) {
    const titleReport = await normalizeChapterTitlesInCopy(mergeReport.outputFile, titleAnalysis);
    const titlePath = writeChapterTitleNormalizationReport(root, titleReport);
    report.steps.titleNormalization = { status: titleReport.status, reportPath: path.relative(root, titlePath), outputFile: titleReport.outputFile, changed: titleReport.changed, validationOk: titleReport.validation?.ok || false };
    if (titleReport.status !== 'success' || !titleReport.validation?.ok) {
      return writeAndReturn(root, { ...report, status: 'failed', blockedAt: 'title-normalization', finalOutputFile }, options.reportFile);
    }
    finalOutputFile = titleReport.outputFile;
  } else {
    report.steps.titleNormalization = { status: titleAnalysis.changed > 0 ? 'skipped' : 'already_normalized', outputFile: null, changed: titleAnalysis.changed };
  }

  return writeAndReturn(root, { ...report, status: 'success', finalOutputFile }, options.reportFile);
}

export function resolveEffectiveSources(items) {
  const sources = [];
  const blockers = [];

  for (const item of items) {
    if (item.status === 'fixed' && item.outputFile) {
      sources.push({ sourceFile: item.sourceFile, sourcePath: item.sourcePath, status: item.status, effectivePath: item.outputFile, effectiveKind: 'fixed-copy' });
      continue;
    }
    if (item.status === 'already_clean') {
      sources.push({ sourceFile: item.sourceFile, sourcePath: item.sourcePath, status: item.status, effectivePath: item.sourcePath, effectiveKind: 'original' });
      continue;
    }
    blockers.push({ sourceFile: item.sourceFile, sourcePath: item.sourcePath, status: item.status, reason: item.error || `unsafe-prechapter-status-${item.status}` });
  }

  return { sources, blockers };
}

export function writeOrchestrationReport(root, report, reportFile = path.join(root, 'reports', 'orchestration', 'm7_orchestration_report.json')) {
  fs.ensureDirSync(path.dirname(reportFile));
  fs.writeJsonSync(reportFile, report, { spaces: 2 });
  return reportFile;
}

function writeAndReturn(root, report, reportFile) {
  const finalReport = { ...report, completedAt: new Date().toISOString() };
  const pathWritten = writeOrchestrationReport(root, finalReport, reportFile);
  return { ...finalReport, reportPath: pathWritten };
}

function startReport(epubs) {
  return {
    generatedAt: new Date().toISOString(),
    status: 'running',
    selectedCount: epubs.length,
    selectedSources: epubs.map((epub) => ({ sourceFile: epub.name || path.basename(epub.path), sourcePath: epub.path })),
    effectiveSources: [],
    blockers: [],
    steps: {}
  };
}

function summarizeBatchStep(batch) {
  return {
    selectedCount: batch.selectedCount,
    applied: batch.applied,
    summary: batch.summary,
    items: batch.items.map((item) => ({
      sourceFile: item.sourceFile,
      status: item.status,
      eligible: item.eligible,
      outputFile: item.outputFile || null,
      error: item.error || null
    }))
  };
}
