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

export function buildRunOutputPath(rootDir, baseName, extension = '.epub') {
  const safeBase = String(baseName || 'book')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'book';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extensionValue = extension.startsWith('.') ? extension : `.${extension}`;
  let candidate = path.join(rootDir, `${safeBase}-${timestamp}${extensionValue}`);
  let counter = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(rootDir, `${safeBase}-${timestamp}-${counter}${extensionValue}`);
    counter += 1;
  }

  return candidate;
}

export async function resolveOutputFilePath(rootDir, baseName, extension = '.epub', askFn = defaultAskForOutputChoice) {
  const safeBase = String(baseName || 'book')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'book';

  const extensionValue = extension.startsWith('.') ? extension : `.${extension}`;
  const defaultPath = path.join(rootDir, `${safeBase}${extensionValue}`);

  const envChoice = String(process.env.EPUB_OUTPUT_MODE ?? '').trim().toLowerCase();
  if (envChoice === 'overwrite') {
    return defaultPath;
  }
  if (envChoice === 'new') {
    return buildRunOutputPath(rootDir, safeBase, extensionValue);
  }

  if (!fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  const answer = await askFn({
    baseName: safeBase,
    extension: extensionValue,
    proposedPath: defaultPath,
  });

  const normalized = String(answer ?? '').trim().toLowerCase();
  if (['s', 'sim', 'sobrescrever', 'overwrite', 'o', '1'].includes(normalized)) {
    return defaultPath;
  }

  return buildRunOutputPath(rootDir, safeBase, extensionValue);
}

async function defaultAskForOutputChoice({ proposedPath }) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    return await rl.question(
      `Já existe um arquivo com este nome em output: ${path.basename(proposedPath)}\n` +
        '[1] Sobrescrever\n' +
        '[2] Criar novo arquivo com data/hora\n' +
        'Escolha: ',
    );
  } finally {
    rl.close();
  }
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
