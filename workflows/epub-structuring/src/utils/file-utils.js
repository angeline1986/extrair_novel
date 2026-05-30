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
