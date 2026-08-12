import fs from 'fs-extra';
import path from 'node:path';

export function writeChapterIntegrityReport(rootDir, report) {
  const reportPath = path.join(rootDir, 'reports', 'reference', 'chapter_integrity_report.json');
  fs.ensureDirSync(path.dirname(reportPath));
  fs.writeJsonSync(reportPath, report, { spaces: 2 });
  return reportPath;
}
