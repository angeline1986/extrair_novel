import path from 'node:path';
import fs from 'fs-extra';
import { writeJsonReport } from '../../utils/report-writer.js';
import { resolveReportOutputDir } from '../../utils/report-output-dir.js';

export async function writeMergePrecheckReport(root, report, options = {}) {
  const reportsDir = resolveReportOutputDir(root, options, 'merge');
  await fs.ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, 'merge_precheck_report.json');
  await writeJsonReport(reportPath, report);
  return reportPath;
}
