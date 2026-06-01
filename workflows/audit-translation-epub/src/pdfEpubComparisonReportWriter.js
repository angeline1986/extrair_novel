import fs from 'fs';
import path from 'path';
import { buildPdfEpubComparisonHtml } from './pdfEpubComparison/reportShell.js';
import { buildPdfEpubComparisonFullText } from './pdfEpubComparison/textReport.js';

export { buildPdfEpubComparisonFullText, buildPdfEpubComparisonHtml };

export function writePdfEpubComparisonReport(audit, htmlPath) {
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, buildPdfEpubComparisonHtml(audit), 'utf8');
  return {
    htmlPath,
    relativePath: htmlPath,
  };
}

export function writePdfEpubComparisonFullText(audit, txtPath) {
  fs.mkdirSync(path.dirname(txtPath), { recursive: true });
  fs.writeFileSync(txtPath, buildPdfEpubComparisonFullText(audit), 'utf8');
  return {
    txtPath,
    relativePath: txtPath,
  };
}
