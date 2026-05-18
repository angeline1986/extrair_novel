import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function entityRegex(value) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, 'giu');
}

function getExamples(text, alias, canonical, maxExamples) {
  const examples = [];
  const regex = entityRegex(alias);
  let match;

  while ((match = regex.exec(text)) !== null && examples.length < maxExamples) {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(text.length, match.index + match[0].length + 60);
    const before = text.slice(start, end).replace(/\s+/g, ' ').trim();
    const after = before.replace(entityRegex(alias), canonical);

    examples.push({ before, after });
  }

  return examples;
}

export function normalizeEntities(text, glossary, options = {}) {
  const { dryRun = true, maxExamples = 5 } = options;
  let normalizedText = text;
  const changes = [];
  const aliases = Object.entries(glossary)
    .flatMap(([canonical, config]) =>
      (config.aliases || []).map((alias) => ({
        canonical,
        alias,
        protected: config.protected !== false,
      }))
    )
    .filter((item) => item.protected)
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { canonical, alias } of aliases) {
    const matches = [...normalizedText.matchAll(entityRegex(alias))];

    if (matches.length === 0) continue;

    changes.push({
      canonical,
      alias,
      found: alias,
      occurrences: matches.length,
      action: dryRun ? 'suggest_replace' : 'replace',
      examples: getExamples(normalizedText, alias, canonical, maxExamples),
    });

    if (!dryRun) {
      normalizedText = normalizedText.replace(entityRegex(alias), canonical);
    }
  }

  const aliasesByCanonical = new Map();
  for (const change of changes) {
    if (!aliasesByCanonical.has(change.canonical)) {
      aliasesByCanonical.set(change.canonical, new Set());
    }
    aliasesByCanonical.get(change.canonical).add(change.found);
  }

  const manualReview = [...aliasesByCanonical.values()].some(
    (aliasesFound) => aliasesFound.size > 1
  );

  return {
    text: normalizedText,
    changed: normalizedText !== text,
    changes,
    manualReview,
    summary: {
      aliasesFound: changes.length,
      totalAliasOccurrences: changes.reduce((sum, change) => sum + change.occurrences, 0),
    },
  };
}

export function normalizeEntitiesInDocx(docxPath, glossary, options = {}) {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');

  if (!entry) {
    throw new Error(`Arquivo DOCX inválido: ${docxPath}`);
  }

  const xml = entry.getData().toString('utf8');
  const $ = cheerio.load(xml, { xmlMode: true });
  const changes = [];
  let changedTextNodes = 0;

  $('w\\:t').each((_, textNode) => {
    const original = $(textNode).text();
    if (!original.trim()) return;

    const result = normalizeEntities(original, glossary, {
      ...options,
      dryRun: false,
    });

    if (!result.changed) return;

    $(textNode).text(result.text);
    changedTextNodes++;
    changes.push(...result.changes);
  });

  if (changedTextNodes > 0) {
    zip.updateFile('word/document.xml', Buffer.from($.xml(), 'utf8'));
    zip.writeZip(docxPath);
  }

  return {
    changed: changedTextNodes > 0,
    changedTextNodes,
    changes,
    manualReview: changes.length > 1,
    summary: {
      aliasesFound: changes.length,
      totalAliasOccurrences: changes.reduce((sum, change) => sum + change.occurrences, 0),
    },
  };
}
