import fs from 'fs';
import path from 'path';

export function defaultManifest() {
  return {
    currentVersion: 0,
    currentPath: 'output',
    origin: 'input/translated',
    versions: [],
    finalOutput: 'output',
  };
}

function entryFileExists(workflowRoot, entry) {
  if (!entry?.output || !entry?.finalFile) return false;
  return fs.existsSync(path.join(workflowRoot, entry.output, entry.finalFile));
}

export function sanitizeManifest(manifest, workflowRoot) {
  const clean = { ...defaultManifest(), ...(manifest || {}) };
  clean.versions = (clean.versions || []).filter((entry) => entryFileExists(workflowRoot, entry));

  if (clean.currentVersion && !clean.versions.some((entry) => Number(entry.version) === Number(clean.currentVersion))) {
    const latest = [...clean.versions].sort((a, b) => Number(b.version) - Number(a.version))[0];
    clean.currentVersion = latest ? Number(latest.version) : 0;
  }

  return clean;
}

export function readManifest(filePath, workflowRoot) {
  if (!fs.existsSync(filePath)) return defaultManifest();
  try {
    return sanitizeManifest(JSON.parse(fs.readFileSync(filePath, 'utf8')), workflowRoot);
  } catch {
    return defaultManifest();
  }
}
