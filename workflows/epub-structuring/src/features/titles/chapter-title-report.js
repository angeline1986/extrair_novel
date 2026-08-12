import fs from 'fs-extra';
import path from 'node:path';

export function writeChapterTitleNormalizationReport(rootDir, report) {
  const reportPath = path.join(rootDir, 'reports', 'titles', 'chapter_title_normalization_report.json');
  fs.ensureDirSync(path.dirname(reportPath));
  fs.writeJsonSync(reportPath, report, { spaces: 2 });
  return reportPath;
}
