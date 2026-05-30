import path from 'path';
import { findSingleEpub, ensureWorkflowDirs } from './utils/file-utils.js';
import { safeFileName } from './utils/text-utils.js';
import { writeJsonReport } from './utils/report-writer.js';
import { readEpub } from './parsers/epub-reader.js';
import { readHtmlDocuments } from './parsers/html-reader.js';
import { analyzeToc } from './analyzers/toc-analyzer.js';
import { detectLanguage } from './analyzers/language-detector.js';
import { detectChapters } from './analyzers/chapter-detector.js';
import { analyzeStructure } from './analyzers/structure-analyzer.js';
import { validateEpub3 } from './validators/epub3-validator.js';
import { buildStructuredEpub } from './builders/epub-builder.js';

const ROOT = process.cwd();

async function main() {
  await ensureWorkflowDirs(ROOT);

  const inputFile = await findSingleEpub(path.join(ROOT, 'input'));
  const epub = readEpub(inputFile);
  const htmlDocs = readHtmlDocuments(epub);
  const tocReport = analyzeToc(epub);
  const languageReport = detectLanguage(epub, htmlDocs);
  const chapterReport = detectChapters(epub, htmlDocs, tocReport);
  const structureReport = analyzeStructure(epub, htmlDocs, chapterReport, tocReport, languageReport);
  const validationReport = validateEpub3(structureReport, chapterReport, tocReport, languageReport);

  const bookName = safeFileName(epub.opf.metadata.title || path.basename(inputFile, '.epub'));
  const outputFile = path.join(ROOT, 'output', `${bookName}-structured.epub`);

  buildStructuredEpub(epub, chapterReport, outputFile);

  await writeJsonReport(path.join(ROOT, 'reports', 'structure_report.json'), structureReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_report.json'), chapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'toc_report.json'), tocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'language_report.json'), languageReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'validation_report.json'), validationReport);

  console.log('EPUB processado pela v7.1.');
  console.log(`Entrada: ${path.relative(ROOT, inputFile)}`);
  console.log(`Saída: ${path.relative(ROOT, outputFile)}`);
}

main().catch((error) => {
  console.error('Falha ao executar workflow.');
  console.error(error.message);
  process.exit(1);
});
