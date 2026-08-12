import * as cheerio from 'cheerio';
import { readEpub } from '../../../parsers/epub-reader.js';
import { readHtmlDocuments } from '../../../parsers/html-reader.js';
import { detectInternalChapters } from '../../../analyzers/internal-chapter-discovery.js';
import { applyBookStructureOverrides } from '../../../utils/book-structure-overrides.js';
import { extractBodyFragmentByRange } from '../../../utils/dom-range-extractor.js';
import { readZipText } from '../../../utils/zip-utils.js';
import { buildReferenceDocument } from '../reference-document.js';

export function loadEpubReference(epubPath) {
  const epub = readEpub(epubPath);
  const htmlDocs = readHtmlDocuments(epub);
  const detected = detectInternalChapters(epub, htmlDocs);
  const chapterReport = applyBookStructureOverrides(epub, detected).chapterReport;
  const chapters = chapterReport.chapters
    .filter((chapter) => chapter.role === 'chapter')
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((chapter, index, all) => {
      const next = all[index + 1];
      const html = readZipText(epub.zip, chapter.fullPath);
      const endDomPath = next?.fullPath === chapter.fullPath ? next.domPath : null;
      const fragment = extractBodyFragmentByRange(html, chapter.domPath, endDomPath);
      return {
        number: chapter.chapterNumber,
        title: chapter.finalTitle || chapter.title,
        heading: chapter.detectedTitle || chapter.finalTitle || chapter.title,
        text: htmlText(fragment),
        sourceLocation: { href: chapter.href, fullPath: chapter.fullPath, domPath: chapter.domPath },
        confidence: chapter.confidence >= 0.8 ? 'high' : 'medium'
      };
    });

  return buildReferenceDocument({
    sourceType: 'epub',
    sourceFile: epubPath,
    language: epub.opf.metadata.language || null,
    title: epub.opf.metadata.title || null,
    chapters
  });
}

function htmlText(fragment) {
  const $ = cheerio.load(`<body>${fragment}</body>`, { xmlMode: true, decodeEntities: true });
  return $('body').text();
}
