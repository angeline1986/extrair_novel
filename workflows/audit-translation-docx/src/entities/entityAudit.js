function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function entityRegex(value) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, 'giu');
}

function countOccurrences(text, term) {
  return [...text.matchAll(entityRegex(term))].length;
}

function collectExamples(text, term, limit = 8) {
  const examples = [];

  for (const match of text.matchAll(entityRegex(term))) {
    const index = match.index || 0;
    const start = Math.max(0, index - 90);
    const end = Math.min(text.length, index + term.length + 90);

    examples.push({
      match: match[0],
      context: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      index,
    });

    if (examples.length >= limit) break;
  }

  return examples;
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
        examples: collectExamples(translatedText, alias),
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
