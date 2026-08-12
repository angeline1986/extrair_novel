import fs from 'fs-extra';
import path from 'node:path';
import { resolveReportOutputDir } from '../../utils/report-output-dir.js';

export function writeChapterIntegrityReport(rootDir, report, options = {}) {
  const reportsDir = resolveReportOutputDir(rootDir, options, 'reference');
  const reportPath = path.join(reportsDir, 'chapter_integrity_report.json');
  fs.ensureDirSync(path.dirname(reportPath));
  fs.writeJsonSync(reportPath, report, { spaces: 2 });
  return reportPath;
}
