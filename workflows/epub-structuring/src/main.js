import path from 'path';
import { findSingleEpub, findOptionalPdf, ensureWorkflowDirs } from './utils/file-utils.js';
import { safeFileName } from './utils/text-utils.js';
import { writeJsonReport } from './utils/report-writer.js';
import { readEpub } from './parsers/epub-reader.js';
import { readHtmlDocuments } from './parsers/html-reader.js';
import { analyzeToc } from './analyzers/toc-analyzer.js';
import { detectLanguage } from './analyzers/language-detector.js';
import { detectChapters } from './analyzers/chapter-detector.js';
import { analyzeStructure } from './analyzers/structure-analyzer.js';
import { extractPdfCanonicalChapters } from './analyzers/pdf-toc-extractor.js';
import { validateEpub3 } from './validators/epub3-validator.js';
import { buildStructuredEpub } from './builders/epub-builder.js';

const ROOT = process.cwd();

async function main() {
  await ensureWorkflowDirs(ROOT);
  const inputDir = path.join(ROOT, 'input');
  const inputFile = await findSingleEpub(inputDir);
  const pdfFile = await findOptionalPdf(inputDir);
  const epub = readEpub(inputFile);
  const htmlDocs = readHtmlDocuments(epub);
  const tocReport = analyzeToc(epub);
  const languageReport = detectLanguage(epub, htmlDocs);
  const pdfTocReport = await extractPdfCanonicalChapters(pdfFile, epub);
  const chapterReport = detectChapters(epub, htmlDocs, tocReport, pdfTocReport);
  const structureReport = analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport);
  const validationReport = validateEpub3(structureReport, chapterReport, tocReport, languageReport);
  const bookName = safeFileName(epub.opf.metadata.title || path.basename(inputFile, '.epub'));
  const outputFile = path.join(ROOT, 'output', `${bookName}-structured.epub`);

  buildStructuredEpub(epub, chapterReport, outputFile);
  await writeJsonReport(path.join(ROOT, 'reports', 'structure_report.json'), structureReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_report.json'), chapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'toc_report.json'), tocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'language_report.json'), languageReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'validation_report.json'), validationReport);

  console.log('EPUB processado pela v7.2 PDF canonical.');
  console.log(`Entrada: ${path.relative(ROOT, inputFile)}`);
  if (pdfFile) console.log(`PDF: ${path.relative(ROOT, pdfFile)}`);
  console.log(`Saída: ${path.relative(ROOT, outputFile)}`);
}

main().catch((error) => {
  console.error('Falha ao executar workflow.');
  console.error(error.message);
  process.exit(1);
});
