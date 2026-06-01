import { chapterLabel, normalizeComparable, preview } from './textUtils.js';

export function makeFinding({
  group,
  chapter,
  type,
  original = '',
  translation = '',
  problem,
  recommendation = 'Validar manualmente no contexto.',
  location = '',
  problematicTerm = '',
  severity = 'medium',
  confidence = 'medium',
  classification = 'heuristic',
}) {
  return {
    group,
    chapter: chapterLabel(chapter),
    type,
    original: preview(original, 360),
    translation: preview(translation, 360),
    problem,
    recommendation,
    location: preview(location, 300),
    problematicTerm,
    severity,
    confidence,
    classification,
  };
}

export function dedupeFindings(findings) {
  const seen = new Set();
  return (findings || []).filter((finding) => {
    const key = [
      finding.group,
      finding.chapter,
      finding.type,
      normalizeComparable(finding.original).slice(0, 80),
      normalizeComparable(finding.translation).slice(0, 80),
      normalizeComparable(finding.problem).slice(0, 80),
      normalizeComparable(finding.location).slice(0, 80),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
