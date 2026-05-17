const { normalizeText, titleCase } = require('./text-processor.cjs');

function parseChapterMetaFromTocTitle(title) {
  const text = normalizeText(title);

  if (/^prologue$/i.test(text) || /^epilogue$/i.test(text)) {
    const label = titleCase(text);
    return {
      arcName: "",
      chapterNumber: label,
      chapterTitle: label,
      rawLines: [],
      isFallback: false,
    };
  }

  let match = text.match(/^(\d+)\.\s+(.+)$/);
  if (!match) {
    match = text.match(/\b(\d+)\.\s+(.+?)(?:\s+\(\d+\/\d+\))?$/);
  }
  if (!match) return null;

  return {
    arcName: "",
    chapterNumber: normalizeText(match[1]),
    chapterTitle: titleCase(match[2]),
    rawLines: [],
    isFallback: false,
  };
}

function parseChapterHeader(lines, tocTitle = "") {
  const cleanLines = lines.slice(0, 40).map(normalizeText).filter(Boolean);

  for (const text of cleanLines) {
    const titledMatch = text.match(/^(.*?)Chapter\s+([\d.]+)\s*:\s*(.+)$/i);
    if (titledMatch) {
      return {
        arcName: normalizeText(titledMatch[1]),
        chapterNumber: normalizeText(titledMatch[2]),
        chapterTitle: titleCase(titledMatch[3]),
        rawLines: [text],
        isFallback: false,
      };
    }
  }

  for (let i = 0; i < cleanLines.length - 1; i++) {
    const current = cleanLines[i];
    const next = cleanLines[i + 1];
    const splitMatch = next.match(/^Chapter\s+([\d.]+)\s*:\s*(.+)$/i);
    if (splitMatch && !/^WTNL/i.test(current) && !/^Chapter/i.test(current)) {
      return {
        arcName: current,
        chapterNumber: normalizeText(splitMatch[1]),
        chapterTitle: titleCase(splitMatch[2]),
        rawLines: [current, next],
        isFallback: false,
      };
    }
  }

  for (const text of cleanLines) {
    const looseMatch = text.match(/^Chapter\s+([\d.]+)\s*:\s*(.+)$/i);
    if (looseMatch) {
      return {
        arcName: "",
        chapterNumber: normalizeText(looseMatch[1]),
        chapterTitle: titleCase(looseMatch[2]),
        rawLines: [text],
        isFallback: false,
      };
    }
  }

  const tocMatch = normalizeText(tocTitle).match(/Chapter\s+([\d.]+)(?::\s*(.+))?/i);
  if (tocMatch) {
    return {
      arcName: "",
      chapterNumber: normalizeText(tocMatch[1]),
      chapterTitle: tocMatch[2] ? titleCase(tocMatch[2]) : "",
      rawLines: [],
      isFallback: false,
    };
  }

  return null;
}

function getChapterGroup(chapterNumber) {
  return String(chapterNumber).split(".")[0];
}

function makeFallbackMeta(item, position) {
  const title = normalizeText(item.title);
  return {
    arcName: "",
    chapterNumber: `Extra ${position}`,
    chapterTitle: title || `Bloco sem título ${position}`,
    rawLines: [],
    isFallback: true,
  };
}

function chapterHeading(meta, fallbackTitle) {
  if (!meta) return normalizeText(fallbackTitle || "Untitled");

  if (/^prologue$/i.test(meta.chapterNumber)) {
    return normalizeText(meta.chapterTitle || fallbackTitle || "Prologue");
  }
  if (/^epilogue$/i.test(meta.chapterNumber)) {
    return normalizeText(meta.chapterTitle || fallbackTitle || "Epilogue");
  }
  if (meta.isFallback) {
    return normalizeText(meta.chapterTitle || fallbackTitle || meta.chapterNumber);
  }
  if (meta.chapterTitle) {
    return normalizeText(`Chapter ${meta.chapterNumber} - ${meta.chapterTitle}`);
  }
  if (fallbackTitle && /Chapter/i.test(fallbackTitle)) {
    return normalizeText(fallbackTitle.replace(":", " -"));
  }
  return normalizeText(`Chapter ${meta.chapterNumber} - Untitled`);
}

module.exports = {
  parseChapterMetaFromTocTitle,
  parseChapterHeader,
  getChapterGroup,
  makeFallbackMeta,
  chapterHeading,
};