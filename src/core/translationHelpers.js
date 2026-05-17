export function normalizeTranslationLine(line = "") {
  return String(line)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function isTranslationEmpty(line = "") {
  return normalizeTranslationLine(line).length === 0;
}

export function normalizeTranslationBlock(text = "") {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasModelNoise(text = "") {
  return (
    /\/think/i.test(text) ||
    /<\/?think>/i.test(text) ||
    /<\/?thinking>/i.test(text) ||
    /<\/?reasoning>/i.test(text) ||
    /^claro[,.!:\s-]*/i.test(text.trim()) ||
    /^aqui está[,.!:\s-]*/i.test(text.trim()) ||
    /^segue[,.!:\s-]*/i.test(text.trim())
  );
}

export function countNonEmptyLines(text = "") {
  return String(text)
    .split(/\n+/)
    .map((line) => normalizeTranslationLine(line))
    .filter(Boolean).length;
}