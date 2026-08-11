export const CorrectionMode = Object.freeze({
  AUTO_SAFE: 'auto_safe',
  AUTO_REVIEW: 'auto_review',
  MANUAL_ONLY: 'manual_only',
});

export const CorrectionRisk = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const CorrectionStatus = Object.freeze({
  PENDING: 'pending',
  NEEDS_REVIEW: 'needs_review',
  MANUAL_ONLY: 'manual_only',
});

export function candidateId(index) {
  return `cand-${String(index + 1).padStart(4, '0')}`;
}

export function actionId(index) {
  return `cp-${String(index + 1).padStart(4, '0')}`;
}

