import fs from 'fs-extra';
import path from 'node:path';

export function writeChapterTitleNormalizationReport(rootDir, report, options = {}) {
  const reportsDir = options.reportContext?.dataDir || path.join(rootDir, 'reports', 'titles');
  const reportPath = path.join(reportsDir, 'chapter_title_normalization_report.json');
  fs.ensureDirSync(path.dirname(reportPath));
  fs.writeJsonSync(reportPath, report, { spaces: 2 });
  return reportPath;
}
