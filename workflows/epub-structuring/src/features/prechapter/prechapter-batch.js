import path from 'node:path';
import { analyzePrechapterContent } from './prechapter-analyzer.js';
import { fixPrechapterContent } from './prechapter-fixer.js';
import { writePrechapterAnalysisReport, writePrechapterFixReport } from './prechapter-report.js';

export async function analyzePrechapterBatch(epubs, root = process.cwd()) {
  const items = [];
  for (const epub of epubs) {
    try {
      const analysis = analyzePrechapterContent(epub.path);
      const analysisReport = await writePrechapterAnalysisReport(root, analysis);
      items.push(buildAnalysisItem(epub, analysis, analysisReport, root));
    } catch (error) {
      items.push(buildFailedItem(epub, error));
    }
  }
  return buildBatchReport(items, { applied: false });
}

export async function applyPrechapterBatch(analysisBatch, root = process.cwd()) {
  const items = [];
  for (const item of analysisBatch.items) {
    if (!item.eligible) {
      items.push(item);
      continue;
    }

    try {
      const fixReport = await fixPrechapterContent(item.sourcePath, item.analysis, {
        outputDir: path.join(root, 'output', 'fixes')
      });
      const fixReportPath = await writePrechapterFixReport(root, fixReport);
      items.push({
        ...item,
        status: fixReport.status,
        outputFile: fixReport.outputFile,
        fixReportPath: path.relative(root, fixReportPath),
        validation: fixReport.validation,
        result: fixReport.result,
        error: fixReport.status === 'fixed' ? null : fixReport.blockReason || fixReport.status
      });
    } catch (error) {
      items.push({ ...item, status: 'failed', error: error.message });
    }
  }
  return buildBatchReport(items, { applied: true });
}

export function summarizeBatch(items) {
  return {
    fixed: count(items, 'fixed'),
    alreadyClean: count(items, 'already_clean'),
    ambiguous: count(items, 'ambiguous'),
    noBoundary: count(items, 'no_boundary'),
    unsupported: count(items, 'unsupported'),
    blocked: count(items, 'blocked'),
    failed: count(items, 'failed'),
    eligible: items.filter((item) => item.eligible).length
  };
}

function buildAnalysisItem(epub, analysis, analysisReport, root) {
  return {
    sourceFile: epub.name || path.basename(epub.path),
    sourcePath: epub.path,
    status: analysis.status,
    eligible: analysis.status === 'candidate_found' && analysis.confidence === 'high',
    chapterNumber: analysis.target?.chapterNumber || null,
    boundarySource: analysis.boundarySource,
    confidence: analysis.confidence,
    preBoundaryCount: analysis.preBoundary?.elementCount || 0,
    outputFile: null,
    analysisReportPath: path.relative(root, analysisReport),
    fixReportPath: null,
    error: null,
    analysis
  };
}

function buildFailedItem(epub, error) {
  return {
    sourceFile: epub.name || path.basename(epub.path),
    sourcePath: epub.path,
    status: 'failed',
    eligible: false,
    chapterNumber: null,
    boundarySource: null,
    confidence: null,
    preBoundaryCount: 0,
    outputFile: null,
    analysisReportPath: null,
    fixReportPath: null,
    error: error.message,
    analysis: null
  };
}

function buildBatchReport(items, { applied }) {
  return {
    generatedAt: new Date().toISOString(),
    selectedCount: items.length,
    applied,
    summary: summarizeBatch(items),
    items
  };
}

function count(items, status) {
  return items.filter((item) => item.status === status).length;
}
