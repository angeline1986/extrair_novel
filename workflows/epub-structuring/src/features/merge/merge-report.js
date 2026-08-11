import fs from 'fs-extra';
import path from 'node:path';

export function writeMergeReport(report, reportFile = 'reports/merge/merge_report.json') {
  fs.ensureDirSync(path.dirname(reportFile));
  fs.writeJsonSync(reportFile, report, { spaces: 2 });
  return reportFile;
}

export function formatMergeResult(report) {
  return [
    `Status: ${report.status}`,
    `Fontes: ${report.sources}`,
    `Capítulos: ${report.chapterCount}`,
    `Range: ${report.globalRange.first}-${report.globalRange.last}`,
    `Saída: ${report.outputFile}`,
    `Relatório: reports/merge/merge_report.json`
  ].join('\n');
}
