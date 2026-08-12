import path from 'path';
import { findSingleEpub, resolveOptionalPdf, ensureWorkflowDirs, getInputDirs, parseCliOptions } from '../utils/file-utils.js';

export async function preparePipelineContext(root, options = {}) {
  const { argv = process.argv.slice(2), log = () => {} } = options;
  const cliOptions = parseCliOptions(argv);

  log('Iniciando EPUB structuring workflow...');
  log('Preparando diretórios...');
  await ensureWorkflowDirs(root);
  const { inputDir, booksDir, referenceFilesDir, validationBaselineDir } = getInputDirs(root);
  const inputFile = await findSingleEpub(booksDir);
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
