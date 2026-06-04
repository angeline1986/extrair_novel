import * as cheerio from 'cheerio';

export function normalizeText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chapterNumberFromSource(source) {
  const match = String(source || '').match(/\/ch-(\d+)\b|ch-?(\d+)/i);
  return match ? Number(match[1] || match[2]) : null;
}

function cleanTitle(value) {
  const text = normalizeText(value).replace(/^\[/, '').replace(/\]$/, '').trim();
  return text || null;
}

function paragraphText($, element) {
  return normalizeText($(element).text());
}

function isTitleOnlyParagraph($, element) {
  const text = paragraphText($, element);
  const strongText = normalizeText($(element).find('strong').first().text());
  return Boolean(strongText && text === strongText);
}

export function parseChapter(html, source) {
  const $ = cheerio.load(html);
  const content = $('#chapterContent');
  const root = content.length ? content : $.root();
  const paragraphElements = root.find('p').toArray();
  const firstParagraph = paragraphElements[0];
  const rawTitle = firstParagraph && isTitleOnlyParagraph($, firstParagraph)
    ? normalizeText($(firstParagraph).find('strong').first().text())
    : '';
  const paragraphs = [];

  paragraphElements.forEach((element, index) => {
    if (index === 0 && rawTitle) return;
    const text = paragraphText($, element);
    if (text) paragraphs.push(text);
  });

  return {
    siteChapter: chapterNumberFromSource(source),
    source,
    title: cleanTitle(rawTitle),
    rawTitle,
    chapterNumberReliable: false,
    alignmentMode: 'text_similarity',
    paragraphCount: paragraphs.length,
    paragraphs,
  };
}
