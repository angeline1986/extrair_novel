import path from 'path';
import fs from 'fs-extra';

export async function ensureWorkflowDirs(root) {
  await fs.ensureDir(path.join(root, 'input'));
  await fs.ensureDir(path.join(root, 'output'));
  await fs.ensureDir(path.join(root, 'reports'));
}

export async function findSingleEpub(inputDir) {
  const entries = await fs.readdir(inputDir);
  const epubs = entries.filter((entry) => entry.toLowerCase().endsWith('.epub'));
  if (epubs.length === 0) throw new Error('Nenhum arquivo .epub encontrado em input/.');
  if (epubs.length > 1) throw new Error('Mais de um EPUB encontrado em input/. Deixe apenas um.');
  return path.join(inputDir, epubs[0]);
}

export async function findOptionalPdf(inputDir) {
  const entries = await fs.readdir(inputDir);
  const pdfs = entries.filter((entry) => entry.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) return null;
  if (pdfs.length > 1) throw new Error('Mais de um PDF encontrado em input/. Deixe apenas um.');
  return path.join(inputDir, pdfs[0]);
}

export async function resolveOptionalPdf(inputDir, options = {}) {
  if (options.noPdf) return null;
  if (options.pdfPath) {
    const explicitPath = path.resolve(options.pdfPath);
    if (!await fs.pathExists(explicitPath)) throw new Error(`PDF informado não encontrado: ${explicitPath}`);
    if (path.extname(explicitPath).toLowerCase() !== '.pdf') throw new Error(`Arquivo informado em --pdf não é PDF: ${explicitPath}`);
    return explicitPath;
  }
  return findOptionalPdf(inputDir);
}

export function parseCliOptions(argv = process.argv.slice(2)) {
  const options = { noPdf: false, pdfPath: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-pdf') {
      options.noPdf = true;
      continue;
    }
    if (arg === '--pdf') {
      const value = argv[i + 1];
      if (!value) throw new Error('Argumento --pdf exige um caminho.');
      options.pdfPath = value;
      i++;
      continue;
    }
    if (arg.startsWith('--pdf=')) {
      options.pdfPath = arg.slice('--pdf='.length);
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (options.noPdf && options.pdfPath) throw new Error('Use --no-pdf ou --pdf, não ambos.');
  return options;
}
