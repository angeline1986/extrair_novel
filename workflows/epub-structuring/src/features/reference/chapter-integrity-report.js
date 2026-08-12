import fs from 'fs-extra';
import path from 'node:path';

export function writeChapterIntegrityReport(rootDir, report, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(rootDir, 'reports', 'reference');
  const reportPath = path.join(reportsDir, 'chapter_integrity_report.json');
  fs.ensureDirSync(path.dirname(reportPath));
  fs.writeJsonSync(reportPath, report, { spaces: 2 });
  return reportPath;
}
