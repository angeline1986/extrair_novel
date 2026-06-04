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
    const key = dedupeKey(finding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleDuplicateKey(finding) {
  if (finding.group !== 'titles') return null;
  const title = [finding.translation, finding.location, finding.original]
    .map((value) => String(value || '').match(/\d+[.)]\s*[^:|]+/u)?.[0] || '')
    .find(Boolean);
  const target = titleTargetFromRecommendation(finding.recommendation);
  if (!title || !target) return null;
  return [
    finding.group,
    normalizeComparable(title),
    normalizeComparable(target),
  ].join('|');
}

function characterDuplicateKey(finding) {
  if (finding.group !== 'characters') return null;
  return [
    finding.group,
    finding.chapter,
    finding.type,
    normalizeComparable(finding.problematicTerm || finding.original).slice(0, 60),
    normalizeComparable(finding.location || finding.translation).slice(0, 180),
    normalizeComparable(finding.recommendation).slice(0, 80),
  ].join('|');
}

function titleTargetFromRecommendation(value) {
  const text = String(value || '').trim();
  const quoted = text.match(/"([^"]+)"/)?.[1];
  if (quoted) return quoted;
  return text
    .replace(/^avaliar substitui[cç][aã]o por\s+/iu, '')
    .replace(/^verificar se .* deveria conter\s+/iu, '')
    .replace(/^aplicar sugest[aã]o\s*/iu, '')
    .replace(/^["“”]+|["“”.]+$/g, '')
    .trim();
}

function dedupeKey(finding) {
  return titleDuplicateKey(finding) || characterDuplicateKey(finding) || [
    finding.group,
    finding.chapter,
    finding.type,
    normalizeComparable(finding.original).slice(0, 80),
    normalizeComparable(finding.translation).slice(0, 80),
    normalizeComparable(finding.problem).slice(0, 80),
    normalizeComparable(finding.location).slice(0, 80),
  ].join('|');
}
