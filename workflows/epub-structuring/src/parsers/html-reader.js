import * as cheerio from 'cheerio';
import { readZipText } from '../utils/zip-utils.js';
import { cleanText } from '../utils/text-utils.js';

export function readHtmlDocuments(epub) {
  return epub.htmlItems.map((item) => readHtmlDocument(epub, item)).filter(Boolean);
}

function readHtmlDocument(epub, item) {
  try {
    const html = readZipText(epub.zip, item.fullPath);
    const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
    const title = cleanText($('title').first().text());
    const heading = cleanText($('h1,h2,h3').first().text());
    const firstBold = cleanText($('b,strong').first().text());
    const paragraphs = $('p').map((_, el) => cleanText($(el).text())).get().filter(Boolean);
    const blockTexts = $('h1,h2,h3,h4,p,div').slice(0, 12).map((_, el) => cleanText($(el).text())).get().filter(Boolean);
    const text = cleanText($('body').text() || $.root().text());
    return {
      id: item.id,
      href: item.href,
      fullPath: item.fullPath,
      title,
      heading,
      firstBold,
      firstParagraph: paragraphs[0] || '',
      blockTexts,
      text,
      textLength: text.length,
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0
    };
  } catch (error) {
    return { id: item.id, href: item.href, fullPath: item.fullPath, error: error.message, text: '', textLength: 0, wordCount: 0, blockTexts: [] };
  }
}
