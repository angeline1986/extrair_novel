import mammoth from "mammoth";
import path from "path";
import { cleanText } from "../utils/fileUtils.js";

export function slugNumber(text, fallback = 999) {
  const match = String(text).match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

export function sortDocxFiles(files) {
  return [...files].sort((a, b) => {
    const na = slugNumber(a, 999);
    const nb = slugNumber(b, 999);
    return na - nb || a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  });
}

export async function readDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

export function parseVolumeFromDocx(fileName, fullText) {
  const lines = fullText
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  let volumeTitle = null;
  const chapters = [];
  let currentChapter = null;

  for (const line of lines) {
    if (/^Volume\s+\d+/i.test(line) || /^Extras\s+Volume\s+\d+/i.test(line)) {
      volumeTitle = line;
      continue;
    }

    if (/^Cap[ií]tulo\s+\d+/i.test(line)) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = { title: line, paragraphs: [] };
      continue;
    }

    if (currentChapter) {
      currentChapter.paragraphs.push(line);
    }
  }

  if (currentChapter) chapters.push(currentChapter);

  if (!volumeTitle) {
    const byFile = fileName.match(/volume[_\s-]*(\d+)/i);
    volumeTitle = byFile ? `Volume ${byFile[1]}` : path.basename(fileName, ".docx");
  }

  return { title: volumeTitle, chapters };
}
