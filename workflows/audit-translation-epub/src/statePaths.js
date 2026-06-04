import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const workflowRoot = path.resolve(__dirname, '..');

export const stateRoot = path.join(workflowRoot, 'state');

export const statePaths = {
  root: stateRoot,
  epubAudit: {
    dir: path.join(stateRoot, 'epub-audit'),
    reviewQueue: path.join(stateRoot, 'epub-audit/review-queue.json'),
    assistedReviewSuggestions: path.join(stateRoot, 'epub-audit/assisted-review-suggestions.json'),
    editorialFindings: path.join(stateRoot, 'epub-audit/editorial-findings.json'),
    semanticCandidates: path.join(stateRoot, 'epub-audit/semantic-candidates.json'),
    legacy: {
      reviewQueue: path.join(stateRoot, 'review-queue.json'),
      assistedReviewSuggestions: path.join(stateRoot, 'assisted-review-suggestions.json'),
      editorialFindings: path.join(stateRoot, 'editorial-findings.json'),
      semanticCandidates: path.join(stateRoot, 'semantic-candidates.json'),
    },
  },
  corrections: {
    dir: path.join(stateRoot, 'corrections'),
    correctionPlan: path.join(stateRoot, 'corrections/correction-plan.json'),
    correctionReport: path.join(stateRoot, 'corrections/correction-report.json'),
    postCorrectionValidation: path.join(stateRoot, 'corrections/post-correction-validation.json'),
    reauditReport: path.join(stateRoot, 'corrections/reaudit-report.json'),
    reauditSummary: path.join(stateRoot, 'corrections/reaudit-summary.json'),
    legacy: {
      correctionPlan: path.join(stateRoot, 'correction-plan.json'),
      correctionReport: path.join(stateRoot, 'correction-report.json'),
      postCorrectionValidation: path.join(stateRoot, 'post-correction-validation.json'),
      reauditReport: path.join(stateRoot, 'reaudit-report.json'),
      reauditSummary: path.join(stateRoot, 'reauditoria-summary.json'),
    },
  },
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
  fs.mkdirSync(statePaths.epubAudit.dir, { recursive: true });
  fs.mkdirSync(statePaths.corrections.dir, { recursive: true });
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

export function epubAuditStatePath(name) {
  return existingStatePath(statePaths.epubAudit[name], statePaths.epubAudit.legacy[name]);
}

export function correctionStatePath(name) {
  return existingStatePath(statePaths.corrections[name], statePaths.corrections.legacy[name]);
}
