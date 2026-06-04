import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const workflowRoot = path.resolve(__dirname, '..');

export const stateRoot = path.join(workflowRoot, 'state');

export const statePaths = {
  root: stateRoot,
  pdfEpub: {
    dir: path.join(stateRoot, 'pdf-epub'),
    comparison: path.join(stateRoot, 'pdf-epub/comparison.json'),
    reviewQueue: path.join(stateRoot, 'pdf-epub/review-queue.json'),
    applicationReport: path.join(stateRoot, 'pdf-epub/application-report.json'),
    legacy: {
      comparison: path.join(stateRoot, 'pdf-epub-comparison.json'),
      reviewQueue: path.join(stateRoot, 'pdf-epub-review-queue.json'),
      applicationReport: path.join(stateRoot, 'pdf-epub-application-report.json'),
    },
  },
};

export function ensureStateDirs() {
  fs.mkdirSync(statePaths.root, { recursive: true });
  fs.mkdirSync(statePaths.pdfEpub.dir, { recursive: true });
}

export function existingStatePath(primaryPath, legacyPath = null) {
  if (fs.existsSync(primaryPath)) return primaryPath;
  if (legacyPath && fs.existsSync(legacyPath)) return legacyPath;
  return primaryPath;
}

export function pdfEpubStatePath(name) {
  return existingStatePath(statePaths.pdfEpub[name], statePaths.pdfEpub.legacy[name]);
}
