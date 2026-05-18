function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function entityRegex(value) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, 'giu');
}

function countOccurrences(text, term) {
  return [...text.matchAll(entityRegex(term))].length;
}

export function auditEntities(translatedText, glossary) {
  const entityIssues = [];
  const canonicalPresence = [];
  const aliasesByCanonical = new Map();

  for (const [canonical, config] of Object.entries(glossary)) {
    const canonicalOccurrences = countOccurrences(translatedText, canonical);

    if (canonicalOccurrences > 0) {
      canonicalPresence.push({
        canonical,
        occurrences: canonicalOccurrences,
      });
    }

    for (const alias of config.aliases || []) {
      const occurrences = countOccurrences(translatedText, alias);

      if (occurrences === 0) continue;

      entityIssues.push({
        type: 'ENTITY_ALIAS_FOUND',
        severity: 'WARN',
        canonical,
        found: alias,
        occurrences,
        suggestion: canonical,
      });

      if (!aliasesByCanonical.has(canonical)) {
        aliasesByCanonical.set(canonical, []);
      }
      aliasesByCanonical.get(canonical).push(alias);
    }
  }

  const aliasesFound = entityIssues.length;
  const totalAliasOccurrences = entityIssues.reduce(
    (sum, issue) => sum + issue.occurrences,
    0
  );

  return {
    status: aliasesFound > 0 ? 'WARN' : 'OK',
    entityIssues,
    canonicalPresence,
    aliasesByCanonical: Object.fromEntries(aliasesByCanonical),
    summary: {
      canonicalEntities: Object.keys(glossary).length,
      aliasesFound,
      totalAliasOccurrences,
    },
  };
}
