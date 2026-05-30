import * as cheerio from 'cheerio';
import { readZipText } from '../utils/zip-utils.js';
import { cleanText, isGenericTitle } from '../utils/text-utils.js';

export function readHtmlDocuments(epub) {
  return epub.htmlItems.map((item) => {
    const html = readZipText(epub.zip, item.fullPath);
    const $ = cheerio.load(html, { xmlMode: false });
    const blockTexts = getBlockTexts($);
    const bodyText = cleanText($('body').text());

    return {
      id: item.id,
      href: item.href,
      fullPath: item.fullPath,
      title: cleanText($('title').first().text()),
      heading: getHeading($),
      firstBold: cleanText($('strong,b').first().text()),
      firstParagraph: cleanText($('p').first().text()),
      blockTexts,
      bodyTextPreview: bodyText.slice(0, 1000),
      textLength: bodyText.length,
      wordCount: countWords(bodyText),
      isEmpty: bodyText.length < 20
    };
  });
}

function getHeading($) {
  const heading = $('h1,h2,h3,h4,h5,h6').filter((_, el) => {
    return !isGenericTitle(cleanText($(el).text()));
  }).first();

  return cleanText(heading.text());
}

function getBlockTexts($) {
  return $('h1,h2,h3,h4,h5,h6,p,div,strong,b,span')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean)
    .slice(0, 40);
}

function countWords(value) {
  const text = cleanText(value);
  return text ? text.split(' ').length : 0;
}
