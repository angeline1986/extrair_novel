import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logWorkflowEvent } from '../observability/workflowLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT || path.resolve(__dirname, '../..');
const inputFixedDir = path.join(projectRoot, 'input-fixed');
const currentDir = path.join(inputFixedDir, 'current');
const originalTranslatedDir = path.join(projectRoot, 'input', 'translatedGoogle');
const manifestPath = path.join(inputFixedDir, 'manifest.json');
const versionWorkflowLog = path.join(projectRoot, 'logs', 'version-workflow.jsonl');

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

function readVersionNumbers() {
  if (!fs.existsSync(inputFixedDir)) return [];

  return fs.readdirSync(inputFixedDir)
    .filter((name) => /^v\d+$/.test(name))
    .map((name) => Number(name.slice(1)))
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
  const known = new Map((manifest.versions || []).map((item) => [item.version, item]));

  for (const version of existingVersions) {
    if (!known.has(version)) {
      known.set(version, buildVersionEntryFromExistingDir(version));
    }
  }

  const versions = [...known.values()].sort((a, b) => a.version - b.version);
  const currentVersion = manifest.currentVersion || (existingVersions.length ? Math.max(...existingVersions) : 0);

  return {
    ...manifest,
    currentVersion,
    currentPath: manifest.currentPath || toRelative(currentDir),
    origin: manifest.origin || toRelative(originalTranslatedDir),
    versions,
  };
}

function logVersionWorkflowEvent(event, payload) {
  ensureDir(path.dirname(versionWorkflowLog));
  fs.appendFileSync(
    versionWorkflowLog,
    `${JSON.stringify({ time: new Date().toISOString(), event, ...payload })}\n`,
    'utf8'
  );
}

export function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    return reconcileManifestWithExistingVersions({
      currentVersion: 0,
      currentPath: toRelative(currentDir),
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

  if (!reset && hasDocxFiles(currentDir)) {
    const result = {
      path: currentDir,
      relativePath: toRelative(currentDir),
      source: 'current',
      reason: 'existing corrected version found',
    };

    logVersionWorkflowEvent('WORKING_INPUT_SELECTED', {
      selected: result.relativePath,
      reason: result.reason,
    });

    return result;
  }

  const result = {
    path: originalTranslatedDir,
    relativePath: toRelative(originalTranslatedDir),
    source: reset ? 'reset_original' : 'original',
    reason: reset ? 'reset-working-copy requested' : 'no corrected version found',
  };

  logVersionWorkflowEvent('WORKING_INPUT_SELECTED', {
    selected: result.relativePath,
    reason: result.reason,
  });

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
  const workingInput = getWorkingInput(options);
  const versions = listVersionNumbers();
  const currentVersion = manifest.currentVersion || (versions.length ? Math.max(...versions) : 0);

  return {
    workingInput: workingInput.relativePath,
    currentVersion,
    nextVersion: getNextVersion(),
    origin: toRelative(originalTranslatedDir),
    flow: [
      'translatedGoogle',
      ...versions.map((version) => `v${version}`),
    ],
    manifest,
  };
}

export function publishVersion({ source, correctedFile, version, step, metadata = {} }) {
  const versionDir = path.join(inputFixedDir, `v${version}`);
  const fileName = path.basename(correctedFile).replace(/_fixed\.docx$/i, '.docx');
  const versionDest = path.join(versionDir, fileName);
  const currentDest = path.join(currentDir, fileName);
  const sourceRelative = path.resolve(source) === currentDir && version > 1
    ? `input-fixed/v${version - 1}`
    : toRelative(source);

  ensureDir(versionDir);
  ensureDir(currentDir);

  fs.copyFileSync(correctedFile, versionDest);
  fs.copyFileSync(correctedFile, currentDest);

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
  manifest.currentPath = toRelative(currentDir);
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

  logVersionWorkflowEvent('VERSION_CREATED', payload);
  logVersionWorkflowEvent('CURRENT_UPDATED', {
    path: toRelative(currentDir),
    version: `v${version}`,
  });
  logWorkflowEvent('VERSION_CREATED', payload);

  return {
    version,
    versionDir,
    versionDest,
    currentDir,
    currentDest,
    manifest,
  };
}

export function getVersionInput(version) {
  return path.join(inputFixedDir, `v${version}`);
}

export function logReauditTarget(target) {
  logVersionWorkflowEvent('REAUDIT_TARGET', {
    target: toRelative(target),
  });
}
