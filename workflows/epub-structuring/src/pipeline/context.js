import path from 'path';
import fs from 'fs-extra';
import { findSingleEpub, resolveOptionalPdf, ensureWorkflowDirs, getInputDirs, parseCliOptions } from '../utils/file-utils.js';

export async function preparePipelineContext(root, options = {}) {
  const { argv = process.argv.slice(2), log = () => {}, epubPath = null } = options;
  const cliOptions = parseCliOptions(argv);

  log('Iniciando EPUB structuring workflow...');
  log('Preparando diretórios...');
  await ensureWorkflowDirs(root);
  const { inputDir, booksDir, referenceFilesDir, validationBaselineDir } = getInputDirs(root);
  const inputFile = epubPath ? await resolveExplicitEpubPath(epubPath) : await findSingleEpub(booksDir);
  const pdfFile = await resolveOptionalPdf(referenceFilesDir, cliOptions);

  log(`EPUB encontrado: ${path.relative(root, inputFile)}`);
  if (cliOptions.noPdf) log('PDF desativado por --no-pdf.');
  if (pdfFile) log(`PDF selecionado: ${path.relative(root, pdfFile)}`);

  return {
    root,
    cliOptions,
    inputDir,
    booksDir,
    referenceFilesDir,
    validationBaselineDir,
    inputFile,
    pdfFile
  };
}

async function resolveExplicitEpubPath(epubPath) {
  const explicitPath = path.resolve(epubPath);
  if (!await fs.pathExists(explicitPath)) throw new Error(`EPUB informado não encontrado: ${explicitPath}`);
  if (path.extname(explicitPath).toLowerCase() !== '.epub') throw new Error(`Arquivo informado não é EPUB: ${explicitPath}`);
  return explicitPath;
}
