import fs from 'fs';
import path from 'path';

function firstEpubInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const file = fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.epub'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];

  return file ? path.join(dirPath, file) : null;
}

function versionFromFilename(file) {
  const match = String(file || '').match(/_v(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function latestEpubInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.epub'))
    .sort((a, b) => {
      const mtimeDiff = fs.statSync(path.join(dirPath, b)).mtimeMs - fs.statSync(path.join(dirPath, a)).mtimeMs;
      if (mtimeDiff !== 0) return mtimeDiff;
      return versionFromFilename(b) - versionFromFilename(a);
    });

  return files[0] ? path.join(dirPath, files[0]) : null;
}

function latestEpubInVersionDir(inputFixedDir, manifest) {
  if (!manifest?.currentVersion) return null;

  const currentVersion = Number(manifest.currentVersion);
  const versionEntry = (manifest.versions || []).find((item) => Number(item.version) === currentVersion);
  const versionDir = versionEntry?.output
    ? path.join(path.dirname(inputFixedDir), versionEntry.output)
    : path.join(inputFixedDir, `v${currentVersion}`);
  const preferredFile = versionEntry?.finalFile || versionEntry?.file;

  if (preferredFile) {
    const preferredPath = path.join(versionDir, preferredFile);
    if (fs.existsSync(preferredPath)) return preferredPath;
  }

  return firstEpubInDir(versionDir);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function resolveEpubTarget({
  workflowRoot,
  outputDir = path.join(workflowRoot, 'output'),
  inputFixedDir = path.join(workflowRoot, 'input-fixed'),
  translatedDir = path.join(workflowRoot, 'input/translated'),
  manifestPath = path.join(inputFixedDir, 'manifest.json'),
} = {}) {
  if (!workflowRoot) throw new Error('workflowRoot e obrigatorio para resolver EPUB alvo.');

  const attempts = [];
  const outputPath = latestEpubInDir(outputDir);
  attempts.push({
    source: 'output',
    dir: outputDir,
    found: Boolean(outputPath),
    filePath: outputPath,
  });
  if (outputPath) {
    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      source: 'output',
      strategy: 'final_output',
      isFallback: false,
      attempts,
    };
  }

  const manifest = readJsonIfExists(manifestPath);
  const fixedPath = latestEpubInVersionDir(inputFixedDir, manifest);
  attempts.push({
    source: 'input-fixed',
    dir: inputFixedDir,
    manifestPath,
    currentVersion: manifest?.currentVersion || null,
    found: Boolean(fixedPath),
    filePath: fixedPath,
  });
  if (fixedPath) {
    return {
      filePath: fixedPath,
      filename: path.basename(fixedPath),
      source: 'input-fixed',
      strategy: 'manifest_current_version',
      version: manifest?.currentVersion || null,
      isFallback: true,
      attempts,
    };
  }

  const translatedPath = firstEpubInDir(translatedDir);
  attempts.push({
    source: 'input/translated',
    dir: translatedDir,
    found: Boolean(translatedPath),
    filePath: translatedPath,
  });
  if (translatedPath) {
    return {
      filePath: translatedPath,
      filename: path.basename(translatedPath),
      source: 'input/translated',
      strategy: 'translated_input',
      isFallback: true,
      attempts,
    };
  }

  return {
    filePath: null,
    filename: null,
    source: null,
    strategy: 'not_found',
    isFallback: true,
    attempts,
  };
}
