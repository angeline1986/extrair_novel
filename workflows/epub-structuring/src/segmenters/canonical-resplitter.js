import * as cheerio from 'cheerio';
import { readZipText } from '../utils/zip-utils.js';
import {
  extractBodyFragmentByRange,
  extractBodyFragmentFromBoundaryToEnd,
  extractBodyFragmentFromStartToBoundary,
  extractWholeBodyFragment,
  buildChapterXhtml,
  wordCountFromXhtml,
  textPreviewFromXhtml,
  containsChapterMarker
} from '../utils/dom-range-extractor.js';
import path from 'path';
import fs from 'fs';

export function performCanonicalResplit(rangeReport, boundaryReport, epub, outputDir) {
  const ranges = rangeReport.ranges;
  if (!ranges.length) {
    return { ok: false, chapterCount: 0, chapters: [] };
  }

  // Criar diretório de saída se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const chapters = [];

  for (const range of ranges) {
    const chapter = extractChapterByRange(range, epub, outputDir);
    if (chapter) {
      chapters.push(chapter);
    }
  }

  // Ordenar por chapterNumber
  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

  const ok = chapters.length === ranges.length && chapters.every(c => c.ok);

  return {
    ok,
    chapterCount: chapters.length,
    chapters
  };
}

function extractChapterByRange(range, epub, outputDir) {
  let bodyContent = '';

  // Caso 1: Capítulo em um único arquivo
  if (range.startFile === range.endFile) {
    const file = epub.spineItems.find(item => item.href === range.startFile);
    if (!file) return null;

    const html = readZipText(epub.zip, file.fullPath);
    const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
    const sourceHeadHtml = $('head').html() || '';

    if (range.endDomPath) {
      // Capítulo termina antes do próximo boundary
      bodyContent = extractBodyFragmentByRange(html, range.startDomPath, range.endDomPath);
    } else {
      // Último capítulo: extrair até o fim
      bodyContent = extractBodyFragmentFromBoundaryToEnd(html, range.startDomPath);
    }

    const xhtml = buildChapterXhtml({ title: range.title, bodyContent, sourceHeadHtml });
    return writeChapterFile(range, xhtml, outputDir);
  }

  // Caso 2: Capítulo atravessa múltiplos arquivos
  bodyContent = extractMultiFileChapter(range, epub);

  // Obter head do primeiro arquivo
  const firstFile = epub.spineItems.find(item => item.href === range.startFile);
  const firstHtml = readZipText(epub.zip, firstFile.fullPath);
  const $ = cheerio.load(firstHtml, { xmlMode: true, decodeEntities: false });
  const sourceHeadHtml = $('head').html() || '';

  const xhtml = buildChapterXhtml({ title: range.title, bodyContent, sourceHeadHtml });
  return writeChapterFile(range, xhtml, outputDir);
}

function extractMultiFileChapter(range, epub) {
  const contentParts = [];

  // Extrair do arquivo inicial até o fim
  const startFile = epub.spineItems.find(item => item.href === range.startFile);
  const startHtml = readZipText(epub.zip, startFile.fullPath);
  const startContent = extractBodyFragmentFromBoundaryToEnd(startHtml, range.startDomPath);
  contentParts.push(startContent);

  // Extrair arquivos intermediários completos
  for (const fileInfo of range.files) {
    if (fileInfo.href === range.startFile || fileInfo.href === range.endFile) continue;

    const file = epub.spineItems.find(item => item.href === fileInfo.href);
    if (!file) continue;

    const html = readZipText(epub.zip, file.fullPath);
    const wholeContent = extractWholeBodyFragment(html);
    contentParts.push(wholeContent);
  }

  // Extrair do arquivo final até o boundary
  if (range.endFile !== range.startFile && range.endDomPath) {
    const endFile = epub.spineItems.find(item => item.href === range.endFile);
    const endHtml = readZipText(epub.zip, endFile.fullPath);
    const endContent = extractBodyFragmentFromStartToBoundary(endHtml, range.endDomPath);
    contentParts.push(endContent);
  }

  return contentParts.join('\n');
}

function writeChapterFile(range, xhtml, outputDir) {
  const fileName = `chapter_${String(range.chapterNumber).padStart(3, '0')}.xhtml`;
  const outputPath = path.join(outputDir, fileName);

  fs.writeFileSync(outputPath, xhtml, 'utf8');

  const wordCount = wordCountFromXhtml(xhtml);
  const firstTextPreview = textPreviewFromXhtml(xhtml, 'first', 160);
  const lastTextPreview = textPreviewFromXhtml(xhtml, 'last', 160);
  const containsNextChapterMarker = range.endBeforeChapterTitle
    ? containsChapterMarker(xhtml, range.endBeforeChapterTitle)
    : false;

  return {
    chapterNumber: range.chapterNumber,
    title: range.title,
    outputFile: fileName,
    wordCount,
    firstTextPreview,
    lastTextPreview,
    containsNextChapterMarker,
    ok: wordCount > 0 && !containsNextChapterMarker
  };
}
