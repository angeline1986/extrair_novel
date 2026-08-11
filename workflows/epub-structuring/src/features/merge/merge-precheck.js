import { inventoryEpubSource } from './epub-inventory.js';

export function buildMergePrecheck(epubPaths) {
  const inventories = epubPaths.map((source) => typeof source === 'string' ? inventoryEpubSource(source) : inventoryEpubSource(source.path));
  return buildMergePrecheckFromInventories(inventories);
}

export function buildMergePrecheckFromInventories(inventories) {
  const orderedSources = [...inventories].sort(compareSources);
  const rangeValidation = validateRanges(orderedSources);
  const metadataDifferences = compareMetadata(orderedSources);
  const resourceCollisions = detectResourceCollisions(orderedSources);
  const warnings = [
    ...rangeValidation.warnings,
    ...metadataDifferences.map((item) => ({ code: 'METADATA_DIFFERENCE', field: item.field })),
    ...resourceCollisions.map((item) => ({ code: item.type === 'samePathDifferentHash' ? 'RESOURCE_COLLISION' : 'RESOURCE_DUPLICATE', path: item.path }))
  ];
  const errors = rangeValidation.errors;

  return {
    generatedAt: new Date().toISOString(),
    status: errors.length ? 'blocked' : 'ready_for_merge',
    sourceCount: orderedSources.length,
    orderedSources,
    globalRange: {
      firstChapter: orderedSources[0]?.firstChapter || null,
      lastChapter: orderedSources.at(-1)?.lastChapter || null
    },
    gaps: rangeValidation.gaps,
    overlaps: rangeValidation.overlaps,
    duplicates: rangeValidation.duplicates,
    metadataDifferences,
    resourceCollisions,
    warnings,
    errors
  };
}

function compareSources(a, b) {
  const aFirst = Number.isInteger(a.firstChapter) ? a.firstChapter : Number.POSITIVE_INFINITY;
  const bFirst = Number.isInteger(b.firstChapter) ? b.firstChapter : Number.POSITIVE_INFINITY;
  return aFirst - bFirst || String(a.sourceFile).localeCompare(String(b.sourceFile), undefined, { numeric: true, sensitivity: 'base' });
}

function validateRanges(sources) {
  const gaps = [];
  const overlaps = [];
  const duplicates = [];
  const warnings = [];
  const errors = [];
  const seen = new Map();

  if (!sources.length) errors.push({ code: 'NO_SOURCES' });

  for (const source of sources) {
    if (!Number.isInteger(source.firstChapter) || !Number.isInteger(source.lastChapter)) {
      errors.push({ code: 'AMBIGUOUS_RANGE', sourceFile: source.sourceFile });
      continue;
    }
    if (source.firstChapter > source.lastChapter) {
      errors.push({ code: 'INVALID_RANGE', sourceFile: source.sourceFile, firstChapter: source.firstChapter, lastChapter: source.lastChapter });
      continue;
    }
    if (source.confidence === 'low') warnings.push({ code: 'LOW_CONFIDENCE_RANGE', sourceFile: source.sourceFile, rangeSource: source.rangeSource });
    for (let chapter = source.firstChapter; chapter <= source.lastChapter; chapter++) {
      const existing = seen.get(chapter);
      if (existing) duplicates.push({ chapter, sources: [existing, source.sourceFile] });
      else seen.set(chapter, source.sourceFile);
    }
  }

  for (let i = 1; i < sources.length; i++) {
    const previous = sources[i - 1];
    const current = sources[i];
    if (!Number.isInteger(previous.lastChapter) || !Number.isInteger(current.firstChapter)) continue;
    if (current.firstChapter > previous.lastChapter + 1) {
      gaps.push({ after: previous.sourceFile, before: current.sourceFile, missingFrom: previous.lastChapter + 1, missingTo: current.firstChapter - 1 });
    }
    if (current.firstChapter <= previous.lastChapter) {
      overlaps.push({ previous: previous.sourceFile, current: current.sourceFile, from: current.firstChapter, to: Math.min(previous.lastChapter, current.lastChapter) });
    }
  }

  if (overlaps.length) errors.push({ code: 'OVERLAP', overlaps });
  if (duplicates.length) errors.push({ code: 'DUPLICATE_CHAPTERS', duplicates });
  if (gaps.length) warnings.push({ code: 'GAP', gaps });

  return { gaps, overlaps, duplicates, warnings, errors };
}

function compareMetadata(sources) {
  const fields = ['title', 'author', 'language', 'publisher'];
  return fields.flatMap((field) => {
    const values = new Map();
    for (const source of sources) {
      const value = source[field] || null;
      if (!values.has(value)) values.set(value, []);
      values.get(value).push(source.sourceFile);
    }
    return values.size > 1 ? [{ field, values: [...values.entries()].map(([value, sourceFiles]) => ({ value, sourceFiles })) }] : [];
  });
}

function detectResourceCollisions(sources) {
  const byPath = new Map();
  for (const source of sources) {
    for (const resource of source.resources.entries) {
      if (!byPath.has(resource.fullPath)) byPath.set(resource.fullPath, []);
      byPath.get(resource.fullPath).push({ sourceFile: source.sourceFile, hash: resource.hash, mediaType: resource.mediaType });
    }
  }

  const collisions = [];
  for (const [resourcePath, entries] of byPath) {
    if (entries.length < 2) continue;
    const hashes = new Set(entries.map((entry) => entry.hash));
    collisions.push({
      path: resourcePath,
      type: hashes.size === 1 ? 'samePathSameHash' : 'samePathDifferentHash',
      entries
    });
  }
  return collisions;
}
