import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logWorkflowEvent } from '../observability/workflowLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT || path.resolve(__dirname, '../..');
const inputFixedDir = path.join(projectRoot, 'input-fixed');
const finalOutputDir = path.join(projectRoot, 'output');
const originalTranslatedDir = path.join(projectRoot, 'input', 'translatedGoogle');
const manifestPath = path.join(inputFixedDir, 'manifest.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toRelative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

function hasDocxFiles(dir) {
  return fs.existsSync(dir) && fs.readdirSync(dir).some((file) =>
    file.toLowerCase().endsWith('.docx')
  );
}

function latestVersionDir() {
  const versions = readVersionNumbers();
  if (!versions.length) return null;
  return path.join(inputFixedDir, `v${Math.max(...versions)}`);
}

function readVersionNumbers() {
  if (!fs.existsSync(inputFixedDir)) return [];

  return fs.readdirSync(inputFixedDir)
    .filter((name) => /^v\d+$/.test(name))
    .map((name) => Number(name.slice(1)))
    .filter((version) => hasDocxFiles(path.join(inputFixedDir, `v${version}`)))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}

function buildVersionEntryFromExistingDir(version) {
  const versionDir = path.join(inputFixedDir, `v${version}`);
  const firstDocx = fs.existsSync(versionDir)
    ? fs.readdirSync(versionDir).find((file) => file.toLowerCase().endsWith('.docx'))
    : null;

  return {
    version,
    source: version === 1
      ? toRelative(originalTranslatedDir)
      : `input-fixed/v${version - 1}`,
    output: toRelative(versionDir),
    file: firstDocx || null,
    createdAt: null,
    step: version,
    metadata: {
      reconciledFromExistingDirectory: true,
    },
  };
}

function reconcileManifestWithExistingVersions(manifest) {
  const existingVersions = readVersionNumbers();
  const existingVersionSet = new Set(existingVersions);
  const known = new Map(
    (manifest.versions || [])
      .filter((item) => existingVersionSet.has(item.version))
      .map((item) => [item.version, item])
  );

  for (const version of existingVersions) {
    if (!known.has(version)) {
      known.set(version, buildVersionEntryFromExistingDir(version));
    }
  }

  const versions = [...known.values()].sort((a, b) => a.version - b.version);
  const currentVersion = existingVersions.length ? Math.max(...existingVersions) : 0;

  return {
    ...manifest,
    currentVersion,
    currentPath: manifest.currentPath || toRelative(finalOutputDir),
    origin: manifest.origin || toRelative(originalTranslatedDir),
    versions,
  };
}

export function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    return reconcileManifestWithExistingVersions({
      currentVersion: 0,
      currentPath: toRelative(finalOutputDir),
      origin: toRelative(originalTranslatedDir),
      versions: [],
    });
  }

  return reconcileManifestWithExistingVersions(
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  );
}

export function saveManifest(manifest) {
  ensureDir(inputFixedDir);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function getWorkingInput(options = {}) {
  const reset = Boolean(options.resetWorkingCopy);
  const shouldLog = options.logEvent !== false;

  const latestDir = latestVersionDir();

  if (!reset && latestDir && hasDocxFiles(latestDir)) {
    const result = {
      path: latestDir,
      relativePath: toRelative(latestDir),
      source: 'latest_version',
      reason: 'existing corrected version found',
    };

    if (shouldLog) {
      logWorkflowEvent('WORKING_INPUT_SELECTED', {
        selected: result.relativePath,
        reason: result.reason,
      });
    }

    return result;
  }

  const result = {
    path: originalTranslatedDir,
    relativePath: toRelative(originalTranslatedDir),
    source: reset ? 'reset_original' : 'original',
    reason: reset ? 'reset-working-copy requested' : 'no corrected version found',
  };

  if (shouldLog) {
    logWorkflowEvent('WORKING_INPUT_SELECTED', {
      selected: result.relativePath,
      reason: result.reason,
    });
  }

  return result;
}

export function listVersionNumbers() {
  return readVersionNumbers();
}

export function getNextVersion() {
  const versions = listVersionNumbers();
  const last = versions.length ? Math.max(...versions) : 0;
  return last + 1;
}

export function getVersionWorkflowInfo(options = {}) {
  const manifest = loadManifest();
  const workingInput = getWorkingInput({ ...options, logEvent: false });
  const versions = listVersionNumbers();
  const currentVersion = manifest.currentVersion || (versions.length ? Math.max(...versions) : 0);

  return {
    workingInput: workingInput.relativePath,
    currentVersion,
    nextVersion: getNextVersion(),
    origin: toRelative(originalTranslatedDir),
    finalOutput: toRelative(finalOutputDir),
    flow: [
      'translatedGoogle',
      ...versions.map((version) => `v${version}`),
      'output',
    ],
    manifest,
  };
}

export function publishVersion({ source, correctedFile, version, step, metadata = {} }) {
  const versionDir = path.join(inputFixedDir, `v${version}`);
  const fileName = path.basename(correctedFile).replace(/_fixed\.docx$/i, '.docx');
  const versionDest = path.join(versionDir, fileName);
  const finalOutputDest = path.join(finalOutputDir, fileName);
  const sourceRelative = toRelative(source);

  ensureDir(versionDir);
  ensureDir(finalOutputDir);

  fs.copyFileSync(correctedFile, versionDest);
  fs.copyFileSync(correctedFile, finalOutputDest);

  const manifest = loadManifest();
  const versionEntry = {
    version,
    source: sourceRelative,
    output: toRelative(versionDir),
    file: fileName,
    createdAt: new Date().toISOString(),
    step,
    metadata,
  };

  manifest.currentVersion = version;
  manifest.currentPath = toRelative(finalOutputDir);
  manifest.finalOutput = toRelative(finalOutputDir);
  manifest.origin = toRelative(originalTranslatedDir);
  manifest.versions = [
    ...(manifest.versions || []).filter((item) => item.version !== version),
    versionEntry,
  ].sort((a, b) => a.version - b.version);

  saveManifest(manifest);

  const payload = {
    version: `v${version}`,
    source: sourceRelative,
    output: toRelative(versionDir),
  };

  logWorkflowEvent('VERSION_CREATED', payload);
  logWorkflowEvent('FINAL_OUTPUT_UPDATED', {
    file: fileName,
    stage: 'atualização output final',
    source: correctedFile,
    destination: finalOutputDest,
    path: toRelative(finalOutputDir),
    version: `v${version}`,
  });

  return {
    version,
    versionDir,
    versionDest,
    finalOutputDir,
    finalOutputDest,
    manifest,
  };
}

export function getVersionInput(version) {
  return path.join(inputFixedDir, `v${version}`);
}

export function logReauditTarget(target) {
  logWorkflowEvent('REAUDIT_TARGET', {
    target: toRelative(target),
  });
}
