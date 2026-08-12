import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readZipText } from '../../utils/zip-utils.js';
import { parseDisplayChapterTitle } from './chapter-title-normalizer.js';

export function analyzeChapterTitles(epubPath) {
  const epub = readEpub(epubPath);
  const items = epub.spineItems
    .filter((item) => ['application/xhtml+xml', 'text/html'].includes(item.mediaType))
    .map((item) => analyzeHtmlItem(epub, item))
    .filter((item) => item.matched);
  const changed = items.filter((item) => item.changed).length;
  const unchanged = items.length - changed;
  return {
    generatedAt: new Date().toISOString(),
    sourceFile: epubPath,
    status: changed ? 'changes_available' : 'already_normalized',
    chapterCount: items.length,
    changed,
    unchanged,
    items
  };
}

function analyzeHtmlItem(epub, item) {
  const html = readZipText(epub.zip, item.fullPath);
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
  const headingNode = $('h1,h2,h3').first();
  const heading = headingNode.text();
  const parsed = parseDisplayChapterTitle(heading);
  return {
    href: item.href,
    fullPath: item.fullPath,
    headingSelector: headingNode.length ? String(headingNode.prop('tagName') || '').toLowerCase() : null,
    matched: parsed.matched,
    chapter: parsed.number,
    before: parsed.original,
    after: parsed.normalized,
    changed: parsed.changed,
    reason: parsed.reason
  };
}
