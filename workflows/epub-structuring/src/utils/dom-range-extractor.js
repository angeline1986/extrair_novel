import * as cheerio from 'cheerio';

export function extractBodyFragmentByRange(html, startDomPath, endDomPath) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });

  const bodyChildren = $('body').children().toArray();
  if (!bodyChildren.length) return '';

  const startIndex = startDomPath
    ? findTopLevelBodyChildIndex($, bodyChildren, firstDomPath(startDomPath))
    : 0;

  const endIndex = endDomPath
    ? findTopLevelBodyChildIndex($, bodyChildren, firstDomPath(endDomPath))
    : bodyChildren.length;

  if (startIndex < 0) {
    throw new Error(`Start DOM path não encontrado: ${startDomPath}`);
  }

  if (endDomPath && endIndex < 0) {
    throw new Error(`End DOM path não encontrado: ${endDomPath}`);
  }

  if (endIndex < startIndex) {
    throw new Error(`Range DOM inválido: start=${startDomPath}; end=${endDomPath}`);
  }

  return bodyChildren
    .slice(startIndex, endIndex)
    .map((node) => $.html(node))
    .join('\n');
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
  const head = cheerio.load(`<head>${sourceHeadHtml}</head>`, {
    xmlMode: true,
    decodeEntities: false
  });

  head('title').remove();

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(lang)}">
<head>
${head('head').html() || ''}
<title>${escapeXml(title)}</title>
</head>
<body>
${ensureHeadingInFragment(bodyContent, title)}
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

function findTopLevelBodyChildIndex($, bodyChildren, domPath) {
  const target = $(domPath).get(0);
  if (!target) return -1;

  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];
    if (child === target || containsNode(child, target)) return i;
  }

  return -1;
}

function containsNode(parent, target) {
  if (!parent?.children) return false;

  for (const child of parent.children) {
    if (child === target) return true;
    if (containsNode(child, target)) return true;
  }

  return false;
}

function firstDomPath(domPath) {
  return String(domPath || '').split('+')[0].trim();
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
