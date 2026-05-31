import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLine(line) {
  return String(line || '').replace(/\s+/g, ' ').trim();
}

function extractChapterNumber(text) {
  const match = String(text || '').match(/^(\d+)[.)]\s+\S/);
  return match ? Number(match[1]) : null;
}

function isPageMarker(line) {
  return /^--\s*\d+\s+of\s+\d+\s*--$/i.test(String(line || '').trim());
}

function isLikelyChapterTitle(line) {
  const normalized = normalizeLine(line);
  if (!normalized) return false;
  if (normalized.length > 120) return false;
  return extractChapterNumber(normalized) !== null;
}

function buildSections(lines, rawText) {
  const sections = [];
  let current = null;
  let fallbackParagraphs = [];

  function closeCurrent() {
    if (!current) return;
    current.rawText = current.paragraphs.join('\n\n');
    current.paragraphCount = current.paragraphs.length;
    current.charCount = current.paragraphs.join('').length;
    sections.push(current);
    current = null;
  }

  for (const line of lines) {
    if (isLikelyChapterTitle(line)) {
      closeCurrent();
      current = {
        index: sections.length,
        title: line,
        chapterNumber: extractChapterNumber(line),
        headings: [line],
        paragraphs: [line],
        rawText: '',
        paragraphCount: 0,
        charCount: 0,
      };
      continue;
    }

    if (current) {
      current.paragraphs.push(line);
    } else {
      fallbackParagraphs.push(line);
    }
  }

  closeCurrent();

  if (!sections.length) {
    const paragraphs = lines.filter((line) => line.length >= 2);
    return [{
      index: 0,
      title: 'PDF',
      chapterNumber: null,
      headings: [],
      paragraphs,
      rawText: paragraphs.join('\n\n'),
      paragraphCount: paragraphs.length,
      charCount: paragraphs.join('').length,
    }];
  }

  if (fallbackParagraphs.length) {
    const prefaceText = fallbackParagraphs.join('\n\n');
    sections.unshift({
      index: 0,
      title: 'Prefacio PDF',
      chapterNumber: null,
      headings: [],
      paragraphs: fallbackParagraphs,
      rawText: prefaceText,
      paragraphCount: fallbackParagraphs.length,
      charCount: fallbackParagraphs.join('').length,
    });
    sections.forEach((section, index) => {
      section.index = index;
    });
  }

  return sections;
}

function textPagesFromResult(result) {
  if (Array.isArray(result?.pages) && result.pages.length) {
    return result.pages.map((page, index) => {
      const text = normalizeText(page.text || '');
      const lines = text.split(/\n+/).map(normalizeLine).filter((line) => line && !isPageMarker(line));
      return {
        index,
        number: index + 1,
        text,
        lines,
        charCount: text.length,
      };
    });
  }

  const text = normalizeText(result?.text || '');
  return [{
    index: 0,
    number: 1,
    text,
    lines: text.split(/\n+/).map(normalizeLine).filter((line) => line && !isPageMarker(line)),
    charCount: text.length,
  }];
}

export async function readPdfFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const pages = textPagesFromResult(result);
    const extractedText = normalizeText(result?.text || pages.map((page) => page.text).join('\n\n'));
    const lines = extractedText.split(/\n+/).map(normalizeLine).filter((line) => line && !isPageMarker(line));
    const rawText = lines.join('\n');
    const textBlocks = lines.filter((line) => line.length >= 2);
    const sections = buildSections(lines, rawText);
    const headings = sections.flatMap((section) => section.headings || []);

    return {
      filePath,
      filename: path.basename(filePath),
      title: path.basename(filePath, path.extname(filePath)),
      pages,
      pageCount: Number(result?.total || pages.length),
      sections,
      paragraphs: textBlocks,
      textBlocks,
      lines,
      headings,
      rawText,
      paragraphCount: textBlocks.length,
      textBlockCount: textBlocks.length,
      headingCount: headings.length,
      charCount: rawText.length,
    };
  } finally {
    await parser.destroy();
  }
}

export async function readFirstPdfFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) throw new Error(`Diretorio nao encontrado: ${dirPath}`);

  const file = fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];

  if (!file) return null;
  return readPdfFile(path.join(dirPath, file));
}
