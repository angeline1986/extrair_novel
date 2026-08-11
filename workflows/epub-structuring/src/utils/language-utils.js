export function normalizeLanguageTag(value, fallback = 'pt-BR') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const parts = raw.replace(/_/g, '-').split('-').filter(Boolean);
  if (!parts.length) return fallback;
  const language = parts[0].toLowerCase();
  const region = parts[1] ? parts[1].toUpperCase() : null;
  return region ? `${language}-${region}` : language;
}

export function languageBase(value) {
  return normalizeLanguageTag(value, '').split('-')[0] || null;
}
