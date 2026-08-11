import path from 'path';
import fs from 'fs-extra';

export async function ensureWorkflowDirs(root) {
  await fs.ensureDir(path.join(root, 'input'));
  await fs.ensureDir(path.join(root, 'output'));
  await fs.ensureDir(path.join(root, 'reports'));
}

export async function cleanOutputDirectory(dirPath) {
  await fs.emptyDir(dirPath);
}

export async function findSinglePdf(inputDir) {
  const entries = await fs.readdir(inputDir);
  const pdfFiles = entries.filter((entry) => entry.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    throw new Error('Nenhum arquivo PDF encontrado em input/. Coloque exatamente um PDF para continuar.');
  }

  if (pdfFiles.length > 1) {
    throw new Error(`Foram encontrados ${pdfFiles.length} PDFs em input/. Deixe apenas um arquivo PDF.`);
  }

  return path.join(inputDir, pdfFiles[0]);
}
