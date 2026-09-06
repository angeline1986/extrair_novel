import path from 'path';
import fs from 'fs-extra';
import { ensureWorkflowDirs, findSinglePdf, resolveOutputFilePath } from './utils/file-utils.js';
import { writeJsonReport } from './utils/report-utils.js';
import { readPdfFile } from './readers/pdf-reader.js';
import { detectChapters } from './analyzers/chapter-detector.js';
import { buildChapterXhtml } from './builders/xhtml-builder.js';
import { buildEpub } from './builders/epub-builder.js';
import { validateEpub } from './validators/epub-validator.js';
import { slugify } from './utils/text-utils.js';

async function main() {
  const workflowRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  console.log('Iniciando PDF to EPUB workflow...');
  console.log(`Workflow: ${workflowRoot}`);

  console.log('Preparando diretórios...');
  await ensureWorkflowDirs(workflowRoot);

  const inputDir = path.join(workflowRoot, 'input');
  const pdfPath = await findSinglePdf(inputDir);
  console.log(`PDF encontrado: ${path.relative(workflowRoot, pdfPath)}`);

  console.log('Lendo e extraindo texto do PDF...');
  const pdfAnalysis = await readPdfFile(pdfPath);
  assertPdfExtraction(pdfAnalysis);

  console.log(
    `PDF lido: ${pdfAnalysis.pageCount} páginas físicas, `
    + `${pdfAnalysis.extractedPageCount} páginas extraídas, `
    + `${pdfAnalysis.textLength} caracteres.`,
  );

  console.log('Detectando capítulos...');
  const chapterReport = detectChapters(pdfAnalysis);
  assertChapterDetection(chapterReport, pdfAnalysis);

  console.log(`Headings encontrados: ${chapterReport.headingsFound}`);
  console.log(`Headings ignorados como sumário: ${chapterReport.headingsIgnoredAsToc}`);
  console.log(`Capítulos detectados: ${chapterReport.chapters.length}`);

  for (const warning of chapterReport.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  const bookTitle = pdfAnalysis.title || pdfAnalysis.fileName.replace(/\.pdf$/i, '');
  const safeTitle = slugify(bookTitle) || 'book';
  const outputFile = await resolveOutputFilePath(path.join(workflowRoot, 'output'), safeTitle, '.epub');

  console.log('Gerando arquivos XHTML dos capítulos...');
  const xhtmlFiles = [];

  for (const [index, chapter] of chapterReport.chapters.entries()) {
    const contents = buildChapterXhtml(chapter);
    const relativePath = path.posix.join('OEBPS', 'xhtml', chapter.href);
    const absolutePath = path.join(workflowRoot, relativePath);

    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, contents, 'utf8');
    xhtmlFiles.push(relativePath);

    if ((index + 1) % 25 === 0 || index + 1 === chapterReport.chapters.length) {
      console.log(`XHTML gerados: ${index + 1}/${chapterReport.chapters.length}`);
    }
  }

  console.log('Empacotando EPUB...');
  const epubResult = await buildEpub({
    rootDir: workflowRoot,
    pdfAnalysis,
    chapters: chapterReport.chapters,
    outputFile,
    xhtmlFiles,
  });

  console.log('Validando EPUB...');
  const validation = validateEpub(outputFile, epubResult);

  console.log('Gravando relatórios...');
  const reports = {
    pdfAnalysis,
    chapters: chapterReport,
    epubStructure: epubResult,
    validation,
  };

  await writeJsonReport(path.join(workflowRoot, 'reports', 'pdf-analysis.json'), reports.pdfAnalysis);
  await writeJsonReport(path.join(workflowRoot, 'reports', 'chapters.json'), reports.chapters);
  await writeJsonReport(path.join(workflowRoot, 'reports', 'epub-structure.json'), reports.epubStructure);
  await writeJsonReport(path.join(workflowRoot, 'reports', 'validation.json'), reports.validation);

  console.log('PDF to EPUB workflow concluído.');
  console.log(`PDF: ${path.relative(workflowRoot, pdfPath)}`);
  console.log(`EPUB: ${path.relative(workflowRoot, outputFile)}`);
  console.log(`Capítulos: ${reports.chapters.chapters.length}`);
  console.log(`Warnings: ${reports.validation.warnings.length + reports.chapters.warnings.length}`);
  console.log(`Errors: ${reports.validation.errors.length}`);
}

function assertPdfExtraction(pdfAnalysis) {
  if (!pdfAnalysis.pageCount || !pdfAnalysis.extractedPageCount) {
    throw new Error('O PDF não produziu páginas válidas durante a extração.');
  }

  if (pdfAnalysis.pageCount !== pdfAnalysis.extractedPageCount) {
    throw new Error(
      `Extração inconsistente: PDF informa ${pdfAnalysis.pageCount} páginas, `
      + `mas ${pdfAnalysis.extractedPageCount} foram extraídas.`,
    );
  }

  if (!pdfAnalysis.textLength) {
    throw new Error('Nenhum texto foi extraído do PDF.');
  }
}

function assertChapterDetection(chapterReport, pdfAnalysis) {
  if (!chapterReport.chapters.length) {
    throw new Error('Nenhum capítulo foi produzido pelo detector.');
  }

  const suspicious = chapterReport.chapters.filter(
    (chapter) => chapter.content.length > Math.max(500000, pdfAnalysis.textLength * 0.25),
  );

  if (suspicious.length > 0) {
    throw new Error(
      `Detecção inconsistente: ${suspicious.length} capítulo(s) contêm uma fração `
      + 'anormalmente grande do livro. O EPUB não será gerado.',
    );
  }
}

main().catch((error) => {
  console.error('Falha ao executar workflow.');
  console.error(error.message);
  process.exit(1);
});
