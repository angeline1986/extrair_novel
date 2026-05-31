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
import { runFinalRegressionValidation } from './validators/final-regression-validator.js';
import { buildStructuredEpub } from './builders/epub-builder.js';
import { analyzeChapterBoundaries } from './analyzers/chapter-boundary-analyzer.js';
import { buildChapterRanges } from './analyzers/chapter-range-builder.js';
import { performCanonicalResplit } from './segmenters/canonical-resplitter.js';

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
  
  // Analisar limites reais dos capítulos no DOM (diagnóstico)
  const boundaryReport = analyzeChapterBoundaries(epub, chapterReport);
  
  // Construir ranges reais dos capítulos a partir dos boundaries
  const rangeReport = buildChapterRanges(boundaryReport, epub);
  
  // Realizar resplit canônico dos capítulos
  const chaptersDir = path.join(ROOT, 'output', 'chapters');
  const resplitReport = performCanonicalResplit(rangeReport, boundaryReport, epub, chaptersDir);
  
  const bookName = safeFileName(epub.opf.metadata.title || path.basename(inputFile, '.epub'));
  const outputFile = path.join(ROOT, 'output', `${bookName}-structured.epub`);

  buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile);

  // Atualizar chapterReport com novos hrefs para reanálise
  const hrefMap = new Map();
  for (const resplitChapter of resplitReport.chapters) {
    hrefMap.set(resplitChapter.chapterNumber, resplitChapter.outputFile);
  }
  const updatedChapters = chapterReport.chapters.map(chapter => {
    if (chapter.role === 'chapter' && chapter.chapterNumber) {
      const newHref = hrefMap.get(chapter.chapterNumber);
      if (newHref) {
        return { ...chapter, href: newHref, fullPath: newHref };
      }
    }
    return chapter;
  });
  const updatedChapterReport = { ...chapterReport, chapters: updatedChapters };

  // Reanalisar EPUB final estruturado completamente
  const finalEpub = readEpub(outputFile);
  const finalHtmlDocs = readHtmlDocuments(finalEpub);
  const finalTocReport = analyzeToc(finalEpub);
  const finalStructureReport = analyzeStructure(finalEpub, finalHtmlDocs, updatedChapterReport, finalTocReport, languageReport);
  const finalValidationReport = validateEpub3(finalStructureReport, updatedChapterReport, finalTocReport, languageReport);

  await writeJsonReport(path.join(ROOT, 'reports', 'structure_report.json'), finalStructureReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_report.json'), chapterReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'toc_report.json'), finalTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'language_report.json'), languageReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'pdf_toc_report.json'), pdfTocReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_boundary_report.json'), boundaryReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_range_report.json'), rangeReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'chapter_resplit_report.json'), resplitReport);
  await writeJsonReport(path.join(ROOT, 'reports', 'validation_report.json'), finalValidationReport);

  // Validação final de regressão
  const finalRegressionReport = runFinalRegressionValidation(path.join(ROOT, 'reports'), outputFile);
  await writeJsonReport(path.join(ROOT, 'reports', 'final_regression_report.json'), finalRegressionReport);

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
