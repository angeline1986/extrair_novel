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
  const supplementalItems = [];

  for (const range of rangeReport.supplementalRanges || []) {
    const item = extractSupplementalByRange(range, epub, outputDir);
    if (item) supplementalItems.push(item);
  }

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
    chapters,
    supplementalItems
  };
}

function extractSupplementalByRange(range, epub, outputDir) {
  const file = epub.spineItems.find(item => item.href === range.startFile);
  if (!file) return null;
  const html = readZipText(epub.zip, file.fullPath);
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const sourceHeadHtml = $('head').html() || '';
  const bodyContent = range.endDomPath
    ? extractBodyFragmentFromStartToBoundary(html, range.endDomPath)
    : extractWholeBodyFragment(html);
  const xhtml = buildChapterXhtml({ title: range.title, bodyContent, sourceHeadHtml, lang: epub.opf.metadata.language });
  const outputPath = path.join(outputDir, range.outputFile);
  fs.writeFileSync(outputPath, xhtml, 'utf8');
  const wordCount = wordCountFromXhtml(xhtml);
  return {
    role: range.role || 'supplemental',
    title: range.title,
    outputFile: range.outputFile,
    href: range.outputFile,
    wordCount,
    firstTextPreview: textPreviewFromXhtml(xhtml, 'first', 160),
    lastTextPreview: textPreviewFromXhtml(xhtml, 'last', 160),
    ok: wordCount > 0
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

    bodyContent = removeTrailingResidualMarker(bodyContent, range.endBeforeChapterNumber);
    const xhtml = buildChapterXhtml({ title: range.title, bodyContent, sourceHeadHtml, lang: epub.opf.metadata.language });
    return writeChapterFile(range, xhtml, outputDir);
  }

  // Caso 2: Capítulo atravessa múltiplos arquivos
  bodyContent = extractMultiFileChapter(range, epub);

  // Obter head do primeiro arquivo
  const firstFile = epub.spineItems.find(item => item.href === range.startFile);
  const firstHtml = readZipText(epub.zip, firstFile.fullPath);
  const $ = cheerio.load(firstHtml, { xmlMode: true, decodeEntities: false });
  const sourceHeadHtml = $('head').html() || '';

  const xhtml = buildChapterXhtml({ title: range.title, bodyContent, sourceHeadHtml, lang: epub.opf.metadata.language });
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
    const endContent = extractOptionalBodyStartToBoundary(endHtml, range.endDomPath);
    if (endContent) contentParts.push(endContent);
  }

  return contentParts.join('\n');
}

function extractOptionalBodyStartToBoundary(html, endDomPath) {
  try {
    return extractBodyFragmentFromStartToBoundary(html, endDomPath);
  } catch (error) {
    if (String(error?.message || '').startsWith('EMPTY_EXTRACTED_RANGE:')) {
      return '';
    }
    throw error;
  }
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

function removeTrailingResidualMarker(fragment, nextChapterNumber) {
  if (!nextChapterNumber) return fragment;
  const $ = cheerio.load(`<body>${fragment}</body>`, { xmlMode: true, decodeEntities: false });
  const last = $('body').find('p,div,h1,h2,h3,h4').last();
  if (!last.length) return fragment;
  const html = last.html() || '';
  const text = last.text().replace(/\s+/g, ' ').trim();
  const marker = String(nextChapterNumber);
  if (text === marker) {
    last.remove();
    return $('body').html() || '';
  }
  if (text.endsWith(` ${marker}`) && new RegExp(`\\s${marker}\\s*$`).test(html)) {
    last.html(html.replace(new RegExp(`\\s${marker}\\s*$`), ''));
    return $('body').html() || '';
  }
  return fragment;
}
