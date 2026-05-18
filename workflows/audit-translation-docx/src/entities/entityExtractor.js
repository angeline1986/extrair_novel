import { readDocxFile } from '../docxReader.js';

const COMMON_FALSE_POSITIVES = new Set([
  'Chapter',
  'Volume',
  'The',
  'This',
  'That',
  'Then',
  'When',
  'While',
  'After',
  'Before',
  'However',
  'Because',
]);

function looksLikeUsefulName(candidate) {
  const parts = candidate.split(/\s+/);

  if (parts.some((part) => COMMON_FALSE_POSITIVES.has(part.replace(/-.+$/, '')))) {
    return false;
  }

  return parts.length >= 2 && parts.length <= 3;
}

export function extractEntitiesFromSource(sourceDocxPath) {
  const sourceDoc = readDocxFile(sourceDocxPath);
  const text = sourceDoc.rawText;
  const counts = new Map();
  const namePattern = /\b[A-Z][a-z]+(?:-[a-z]+)?(?:\s+[A-Z][a-z]+(?:-[a-z]+)?){1,2}\b/g;
  let match;

  while ((match = namePattern.exec(text)) !== null) {
    const name = match[0].trim();

    if (!looksLikeUsefulName(name)) continue;

    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((entity) => entity.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
