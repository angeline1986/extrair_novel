import path from 'node:path';
import fs from 'fs-extra';
import { writeJsonReport } from '../../utils/report-writer.js';

export async function writePrechapterAnalysisReport(root, result, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(root, 'reports', 'prechapter');
  await fs.ensureDir(reportsDir);
  const fileName = `${safeReportName(result.sourceFile)}-prechapter-analysis.json`;
  const reportPath = path.join(reportsDir, fileName);
  await writeJsonReport(reportPath, result);
  return reportPath;
}

export async function writePrechapterFixReport(root, result, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(root, 'reports', 'prechapter');
  await fs.ensureDir(reportsDir);
  const fileName = `${safeReportName(result.sourceFile)}-prechapter-fix.json`;
  const reportPath = path.join(reportsDir, fileName);
  await writeJsonReport(reportPath, result);
  return reportPath;
}

export async function writePrechapterBatchReport(root, result, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(root, 'reports', 'prechapter');
  await fs.ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, 'batch_report.json');
  await writeJsonReport(reportPath, result);
  return reportPath;
}

function safeReportName(value) {
  return String(value || 'epub')
    .replace(/\.epub$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'epub';
}
