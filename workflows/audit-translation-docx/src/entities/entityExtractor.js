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

function contextAround(text, index, length, radius = 90) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);

  return text.slice(start, end).replace(/\s+/g, ' ').trim();
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

    const current = counts.get(name) || { count: 0, examples: [] };
    current.count += 1;
    if (current.examples.length < 8) {
      current.examples.push({
        match: name,
        context: contextAround(text, match.index, name.length),
        index: match.index,
      });
    }
    counts.set(name, current);
  }

  return [...counts.entries()]
    .map(([name, data]) => ({ name, count: data.count, examples: data.examples }))
    .filter((entity) => entity.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
