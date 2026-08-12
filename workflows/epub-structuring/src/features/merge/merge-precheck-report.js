import path from 'node:path';
import fs from 'fs-extra';
import { writeJsonReport } from '../../utils/report-writer.js';

export async function writeMergePrecheckReport(root, report, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(root, 'reports', 'merge');
  await fs.ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, 'merge_precheck_report.json');
  await writeJsonReport(reportPath, report);
  return reportPath;
}
