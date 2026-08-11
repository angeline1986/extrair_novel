import * as cheerio from 'cheerio';
import { normalizeLanguageTag } from './language-utils.js';

export function extractBodyFragmentByRange(html, startDomPath, endDomPath) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });

  const body = $('body').first();
  if (!body.length) return '';

  const startSelector = startDomPath ? firstDomPath(startDomPath) : null;
  const endSelector = endDomPath ? firstDomPath(endDomPath) : null;
  const startNode = startSelector ? $(startSelector).get(0) : body.get(0);
  const endNode = endSelector ? $(endSelector).get(0) : null;

  if (startSelector && !startNode) {
    throw new Error(`Start DOM path não encontrado: ${startDomPath}`);
  }

  if (endSelector && !endNode) {
    throw new Error(`End DOM path não encontrado: ${endDomPath}`);
  }

  if (startNode && endNode && startNode === endNode) {
    throw new Error(`INVALID_RANGE_SAME_BOUNDARY: ${startDomPath}`);
  }

  if (startNode && endNode && compareDocumentOrder($, startNode, endNode) >= 0) {
    throw new Error(`Range DOM inválido: start=${startDomPath}; end=${endDomPath}`);
  }

  const clonedBody = cheerio.load(`<html><body>${body.html() || ''}</body></html>`, {
    xmlMode: true,
    decodeEntities: false
  });

  const clonedStart = startSelector ? clonedBody(startSelector).get(0) : clonedBody('body').get(0);
  const clonedEnd = endSelector ? clonedBody(endSelector).get(0) : null;

  if (startSelector && !clonedStart) throw new Error(`Start DOM path não encontrado no clone: ${startDomPath}`);
  if (endSelector && !clonedEnd) throw new Error(`End DOM path não encontrado no clone: ${endDomPath}`);

  if (clonedStart && clonedEnd && clonedStart === clonedEnd) {
    throw new Error(`INVALID_RANGE_SAME_BOUNDARY: ${startDomPath}`);
  }

  if (clonedEnd) removeNodeAndAfter(clonedBody, clonedEnd);
  if (startSelector) removeBeforeNode(clonedBody, clonedStart);

  const fragment = clonedBody('body').html() || '';
  if (!normalizeSpace(cheerio.load(`<body>${fragment}</body>`, { xmlMode: true, decodeEntities: true })('body').text())) {
    throw new Error(`EMPTY_EXTRACTED_RANGE: start=${startDomPath || 'BODY_START'}; end=${endDomPath || 'BODY_END'}`);
  }

  return fragment;
}

export function extractBodyFragmentFromStartToBoundary(html, endDomPath) {
  return extractBodyFragmentByRange(html, null, endDomPath);
}

export function extractBodyFragmentFromBoundaryToEnd(html, startDomPath) {
  return extractBodyFragmentByRange(html, startDomPath, null);
}

export function extractWholeBodyFragment(html) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  return $('body').children().toArray().map((node) => $.html(node)).join('\n');
}

export function buildChapterXhtml({ title, bodyContent, sourceHeadHtml = '', lang = 'es' }) {
  const language = normalizeLanguageTag(lang);
  const head = cheerio.load(`<head>${sourceHeadHtml}</head>`, {
    xmlMode: true,
    decodeEntities: false
  });

  head('title').remove();

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
${head('head').html() || ''}
<title>${escapeXml(title)}</title>
</head>
<body>
${prepareBodyFragment(bodyContent, title)}
</body>
</html>`;
}

export function wordCountFromXhtml(xhtml) {
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  const text = normalizeSpace($('body').text());
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function textPreviewFromXhtml(xhtml, mode = 'first', maxLength = 160) {
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  const text = normalizeSpace($('body').text());
  if (mode === 'last') return text.slice(-maxLength);
  return text.slice(0, maxLength);
}

export function containsChapterMarker(xhtml, title) {
  if (!title) return false;
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  const bodyText = $('body').text();
  
  // Normalizar espaços e remover caracteres especiais
  const normalizedBody = normalizeSpace(bodyText)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const normalizedTitle = normalizeSpace(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Procurar apenas como início de bloco textual (precedido por espaço ou início)
  const patterns = [
    new RegExp(`^${normalizedTitle}\\b`, 'm'),
    new RegExp(`\\s${normalizedTitle}\\b`, 'm')
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(normalizedBody)) return true;
  }
  
  return false;
}

function ensureHeadingInFragment(fragment, title) {
  const $ = cheerio.load(`<body>${fragment}</body>`, {
    xmlMode: true,
    decodeEntities: false
  });

  const first = $('body').children().first();
  const tag = String(first.prop('tagName') || '').toLowerCase();

  if (['h1', 'h2', 'h3', 'p', 'div'].includes(tag)) {
    const firstText = normalizeComparable(first.text());
    const titleText = normalizeComparable(title);

    if (firstText === titleText || firstText.includes(titleText)) {
      return $('body').html() || '';
    }
  }

  $('body').prepend(`<h1>${escapeXml(title)}</h1>\n`);
  return $('body').html() || '';
}

export function prepareBodyFragment(fragment, title) {
  return sanitizeBodyFragment(cleanLeadingDuplicateHeading(ensureHeadingInFragment(fragment, title), title));
}

function sanitizeBodyFragment(fragment) {
  const $ = cheerio.load(`<body>${fragment}</body>`, {
    xmlMode: true,
    decodeEntities: false
  });

  $('body').find('*').each((_, el) => {
    const tag = String(el.tagName || '').toLowerCase();
    const node = $(el);
    if (!isAllowedXhtmlTag(tag)) {
      node.replaceWith(node.contents());
      return;
    }
    if (tag === 'a' && !node.attr('href')) {
      node.replaceWith(node.contents());
      return;
    }
    cleanAttributes(node, tag);
  });

  return $('body').html() || '';
}

function isAllowedXhtmlTag(tag) {
  return new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'cite', 'code', 'del', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'q',
    'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th',
    'thead', 'tr', 'u', 'ul'
  ]).has(tag);
}

function cleanAttributes(node, tag) {
  const allowed = new Set(['class', 'id', 'style', 'title', 'lang', 'xml:lang']);
  if (tag === 'a') allowed.add('href');
  if (tag === 'img') {
    allowed.add('src');
    allowed.add('alt');
  }
  for (const name of Object.keys(node.attr() || {})) {
    if (!allowed.has(name)) node.removeAttr(name);
  }
}

function cleanLeadingDuplicateHeading(fragment, title) {
  const $ = cheerio.load(`<body>${fragment}</body>`, {
    xmlMode: true,
    decodeEntities: false
  });

  const first = $('body').children().first();
  if (String(first.prop('tagName') || '').toLowerCase() !== 'h1') return $('body').html() || '';

  const chapterNumber = extractDisplayChapterNumber(title);
  const titleOnly = extractDisplayTitleOnly(title);
  let removed = false;

  for (let i = 0; i < 5; i++) {
    const node = first.next();
    if (!node.length) break;
    const result = removeLeadingDuplicateNode($, node, chapterNumber, titleOnly);
    if (result === 'removed') {
      removed = true;
      continue;
    }
    if (result === 'empty') continue;
    break;
  }

  return removed ? ($('body').html() || '') : fragment;
}

function removeLeadingDuplicateNode($, node, chapterNumber, titleOnly) {
  const text = normalizeSpace(node.text());
  if (!text) {
    node.remove();
    return 'empty';
  }

  const tag = String(node.prop('tagName') || '').toLowerCase();
  if (!['a', 'div', 'section'].includes(tag)) {
    if (isOwnChapterMarker(text, chapterNumber) || isOwnChapterTitle(text, titleOnly) || isLeadingChapterListResidue(text)) {
      node.remove();
      return 'removed';
    }
    return 'keep';
  }

  let removed = false;
  for (let i = 0; i < 5; i++) {
    const child = node.children().first();
    if (!child.length) break;
    const childText = normalizeSpace(child.text());
    if (!childText) {
      child.remove();
      continue;
    }
    if (isOwnChapterMarker(childText, chapterNumber) || isOwnChapterTitle(childText, titleOnly) || isLeadingChapterListResidue(childText)) {
      child.remove();
      removed = true;
      continue;
    }
    break;
  }
  if (!normalizeSpace(node.text())) {
    node.remove();
    return removed ? 'removed' : 'empty';
  }
  return removed ? 'removed' : 'keep';
}

function isLeadingChapterListResidue(text) {
  return /^cap[ií]tulo\s+\d{1,4}$/i.test(normalizeSpace(text));
}

function extractDisplayChapterNumber(title) {
  const match = String(title || '').match(/^(\d{1,4})\./);
  return match ? Number(match[1]) : null;
}

function extractDisplayTitleOnly(title) {
  return String(title || '').replace(/^\d{1,4}\.\s*/, '').trim();
}

function isOwnChapterMarker(text, chapterNumber) {
  if (!chapterNumber) return false;
  const normalized = normalizeComparable(text);
  return normalized === `capitulo ${chapterNumber}` ||
    normalized === String(chapterNumber) ||
    normalized.startsWith(`${chapterNumber} `);
}

function isOwnChapterTitle(text, titleOnly) {
  const normalizedText = normalizeComparable(removeFootnoteMarkerBeforeParenthetical(text));
  const normalizedTitle = normalizeComparable(titleOnly);
  return normalizedText === normalizedTitle;
}

function removeFootnoteMarkerBeforeParenthetical(text) {
  return String(text || '').replace(/([A-Za-zÀ-ÿ])\d+\)\s*(\(\d+\))$/, '$1 $2');
}

function firstDomPath(domPath) {
  return String(domPath || '').split('+')[0].trim();
}

function removeBeforeNode($, node) {
  let current = node;
  while (current && current.parent && current.parent.type !== 'root') {
    for (const sibling of previousElementSiblings(current)) {
      $(sibling).remove();
    }
    current = current.parent;
  }
}

function removeNodeAndAfter($, node) {
  let current = node;
  let removeCurrent = true;
  while (current && current.parent && current.parent.type !== 'root') {
    for (const sibling of nextElementSiblings(current)) {
      $(sibling).remove();
    }
    const parent = current.parent;
    if (removeCurrent) {
      $(current).remove();
      removeCurrent = false;
    }
    current = parent;
  }
}

function previousElementSiblings(node) {
  const siblings = node.parent?.children || [];
  const index = siblings.indexOf(node);
  return siblings.slice(0, index).filter((sibling) => sibling.type === 'tag');
}

function nextElementSiblings(node) {
  const siblings = node.parent?.children || [];
  const index = siblings.indexOf(node);
  return siblings.slice(index + 1).filter((sibling) => sibling.type === 'tag');
}

function compareDocumentOrder($, a, b) {
  const all = $('body *').toArray();
  return all.indexOf(a) - all.indexOf(b);
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
