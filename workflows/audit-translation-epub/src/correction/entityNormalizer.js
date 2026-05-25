import fs from 'fs';

export function loadEntitiesGlossary(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      schemaVersion: '1.0',
      entities: [],
    };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    schemaVersion: parsed.schemaVersion || '1.0',
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
  };
}

export function normalizeEntityAliasEntries(glossary) {
  const entries = [];

  for (const entity of glossary.entities || []) {
    if (!entity || !entity.canonical || !Array.isArray(entity.aliases)) continue;

    for (const alias of entity.aliases) {
      if (!alias || !alias.from) continue;
      const safe = alias.safe === true || alias.mode === 'auto_safe';
      entries.push({
        from: String(alias.from),
        to: String(alias.to || entity.canonical),
        mode: safe ? 'auto_safe' : 'auto_review',
        confidence: Number(alias.confidence ?? (safe ? 0.98 : 0.7)),
        note: alias.note || entity.note || null,
        entity: entity.canonical,
        source: 'glossary:entities',
      });
    }
  }

  return entries;
}

