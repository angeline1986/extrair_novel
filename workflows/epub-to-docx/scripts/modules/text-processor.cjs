function cleanForDocx(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\uFFFE|\uFFFF/g, "")
    .trim();
}

function normalizeText(text) {
  return cleanForDocx(text).replace(/\s+/g, " ").trim();
}

function titleCase(str) {
  if (!str) return "";

  const lowerWords = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "from",
    "in", "into", "nor", "of", "on", "or", "over", "the", "to", "with",
  ]);

  return normalizeText(str)
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function isTextualEpubPath(filePath) {
  return /\.(xhtml|html|htm)$/i.test(filePath);
}

module.exports = {
  cleanForDocx,
  normalizeText,
  titleCase,
  isTextualEpubPath,
};