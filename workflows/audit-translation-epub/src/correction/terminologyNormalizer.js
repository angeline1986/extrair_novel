import fs from 'fs';

export function loadTermsGlossary(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      schemaVersion: '1.0',
      terms: [],
    };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    schemaVersion: parsed.schemaVersion || '1.0',
    terms: Array.isArray(parsed.terms) ? parsed.terms : [],
  };
}

export function normalizeTermEntries(glossary) {
  return (glossary.terms || [])
    .filter((term) => term && term.from && term.to)
    .map((term) => ({
      from: String(term.from),
      to: String(term.to),
      mode: term.mode === 'auto_review' ? 'auto_review' : 'auto_safe',
      confidence: Number(term.confidence ?? (term.mode === 'auto_review' ? 0.7 : 0.99)),
      note: term.note || null,
      source: 'glossary:terms',
    }));
}

