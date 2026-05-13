export function normalizeTranslationLine(line = "") {
  return String(line)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function isTranslationEmpty(line = "") {
  return normalizeTranslationLine(line).length === 0;
}
