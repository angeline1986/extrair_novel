import path from 'path';
import { findSingleEpub, resolveOptionalPdf, ensureWorkflowDirs, parseCliOptions } from '../utils/file-utils.js';

export async function preparePipelineContext(root, options = {}) {
  const { argv = process.argv.slice(2), log = () => {} } = options;
  const cliOptions = parseCliOptions(argv);

  log('Iniciando EPUB structuring workflow...');
  log('Preparando diretórios...');
  await ensureWorkflowDirs(root);
  const inputDir = path.join(root, 'input');
  const inputFile = await findSingleEpub(inputDir);
  const pdfFile = await resolveOptionalPdf(inputDir, cliOptions);

  log(`EPUB encontrado: ${path.relative(root, inputFile)}`);
  if (cliOptions.noPdf) log('PDF desativado por --no-pdf.');
  if (pdfFile) log(`PDF selecionado: ${path.relative(root, pdfFile)}`);

  return {
    root,
    cliOptions,
    inputDir,
    inputFile,
    pdfFile
  };
}
