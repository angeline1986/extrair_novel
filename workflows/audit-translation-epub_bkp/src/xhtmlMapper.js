import path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readZipText(zip, filePath) {
  const entry = zip.getEntry(filePath);
  if (!entry) throw new Error(`Arquivo nao encontrado no EPUB: ${filePath}`);
  return entry.getData().toString('utf8');
}

function loadOpfPath(zip) {
  const containerXml = readZipText(zip, 'META-INF/container.xml');
  const $ = cheerio.load(containerXml, { xmlMode: true });
  const rootfile = $('rootfile').attr('full-path');
  if (!rootfile) throw new Error('Nao foi possivel encontrar rootfile em META-INF/container.xml');
  return rootfile.replaceAll('\\', '/');
}

function loadSpine(zip, opfPath) {
  const opfDir = path.dirname(opfPath);
  const opfContent = readZipText(zip, opfPath);
  const $ = cheerio.load(opfContent, { xmlMode: true });
  const manifest = new Map();

  $('manifest item, opf\\:manifest opf\\:item').each((_, item) => {
    const el = $(item);
    const id = el.attr('id');
    const href = el.attr('href');
    if (!id || !href) return;

    manifest.set(id, {
      id,
      href,
      mediaType: el.attr('media-type') || '',
      fullPath: path.normalize(path.join(opfDir, href)).replaceAll('\\', '/'),
    });
  });

  const spine = [];
  $('spine itemref, opf\\:spine opf\\:itemref').each((_, itemref) => {
    const idref = $(itemref).attr('idref');
    const item = manifest.get(idref);
    if (!item) return;

    const isTextual =
      /application\/xhtml\+xml|text\/html/i.test(item.mediaType) ||
      /\.(xhtml?|html?)$/i.test(item.href);

    if (isTextual) {
      spine.push({
        ...item,
        spineIndex: spine.length,
      });
    }
  });

  return spine;
}

function stableId({ spineIndex, paragraphIndex, textNodeIndex }) {
  return [
    `s${String(spineIndex).padStart(4, '0')}`,
    `p${String(paragraphIndex).padStart(4, '0')}`,
    `t${String(textNodeIndex).padStart(4, '0')}`,
  ].join('-');
}

function textPreview(text) {
  return normalizeText(text).slice(0, 220);
}

function isSkippableNode(node) {
  let current = node.parent;
  while (current) {
    const tagName = String(current.tagName || '').toLowerCase();
    if (['script', 'style', 'svg', 'nav', 'head'].includes(tagName)) return true;
    current = current.parent;
  }
  return false;
}

function collectTextNodes($, block, locationBase, globalOffset) {
  const textNodes = [];
  let textNodeIndex = 0;
  let runningOffset = globalOffset;

  $(block).find('*').addBack().contents().each((_, node) => {
    if (node.type !== 'text') return;
    if (isSkippableNode(node)) return;

    const text = normalizeText(node.data);
    if (!text || text.length < 2) return;

    const location = {
      id: stableId({ ...locationBase, textNodeIndex }),
      filePath: locationBase.filePath,
      spineIndex: locationBase.spineIndex,
      paragraphIndex: locationBase.paragraphIndex,
      textNodeIndex,
      text,
      textPreview: textPreview(text),
      globalStart: runningOffset,
      globalEnd: runningOffset + text.length,
    };

    textNodes.push(location);
    runningOffset += text.length + 1;
    textNodeIndex += 1;
  });

  return {
    textNodes,
    nextGlobalOffset: runningOffset,
  };
}

function extractBlocks(html, spineItem, globalOffset) {
  const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
  const blocks = [];
  const selector = 'h1,h2,h3,h4,h5,h6,p,blockquote,li';
  let paragraphIndex = 0;
  let runningOffset = globalOffset;

  $(selector).each((_, block) => {
    const blockText = normalizeText($(block).text());
    if (!blockText || blockText.length < 2) return;

    const locationBase = {
      filePath: spineItem.fullPath,
      spineIndex: spineItem.spineIndex,
      paragraphIndex,
    };
    const result = collectTextNodes($, block, locationBase, runningOffset);
    if (!result.textNodes.length) return;

    const paragraph = {
      id: `s${String(spineItem.spineIndex).padStart(4, '0')}-p${String(paragraphIndex).padStart(4, '0')}`,
      filePath: spineItem.fullPath,
      spineIndex: spineItem.spineIndex,
      paragraphIndex,
      tagName: String(block.tagName || '').toLowerCase(),
      text: blockText,
      textPreview: textPreview(blockText),
      textNodes: result.textNodes,
    };

    blocks.push(paragraph);
    paragraphIndex += 1;
    runningOffset = result.nextGlobalOffset + 1;
  });

  return {
    blocks,
    nextGlobalOffset: runningOffset,
  };
}

export function buildXhtmlMap(epubPath) {
  const zip = new AdmZip(epubPath);
  const opfPath = loadOpfPath(zip);
  const spine = loadSpine(zip, opfPath);
  const files = [];
  const textNodes = [];
  let globalOffset = 0;

  for (const item of spine) {
    let html = '';
    try {
      html = readZipText(zip, item.fullPath);
    } catch {
      continue;
    }

    const extracted = extractBlocks(html, item, globalOffset);
    const fileTextNodes = extracted.blocks.flatMap((block) => block.textNodes);
    files.push({
      filePath: item.fullPath,
      href: item.href,
      spineIndex: item.spineIndex,
      paragraphCount: extracted.blocks.length,
      textNodeCount: fileTextNodes.length,
      paragraphs: extracted.blocks,
    });
    textNodes.push(...fileTextNodes);
    globalOffset = extracted.nextGlobalOffset + 2;
  }

  return {
    schemaVersion: '1.0',
    epubPath,
    opfPath,
    spine: files.map((file) => ({
      filePath: file.filePath,
      href: file.href,
      spineIndex: file.spineIndex,
      paragraphCount: file.paragraphCount,
      textNodeCount: file.textNodeCount,
    })),
    files,
    textNodes,
    stats: {
      spineItems: files.length,
      paragraphs: files.reduce((sum, file) => sum + file.paragraphCount, 0),
      textNodes: textNodes.length,
    },
  };
}

export function locationFromTextNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    filePath: node.filePath,
    spineIndex: node.spineIndex,
    paragraphIndex: node.paragraphIndex,
    textNodeIndex: node.textNodeIndex,
    textPreview: node.textPreview,
  };
}

export function findTextLocations(xhtmlMap, needle, limit = 25) {
  if (!xhtmlMap || !needle) return [];
  const lowerNeedle = String(needle).toLowerCase();
  const locations = [];

  for (const node of xhtmlMap.textNodes || []) {
    if (!String(node.text || '').toLowerCase().includes(lowerNeedle)) continue;
    locations.push(locationFromTextNode(node));
    if (locations.length >= limit) break;
  }

  return locations;
}

export function findLocationByGlobalIndex(xhtmlMap, index) {
  if (!xhtmlMap || typeof index !== 'number' || index < 0) return null;
  const node = (xhtmlMap.textNodes || []).find((item) => index >= item.globalStart && index <= item.globalEnd);
  return locationFromTextNode(node);
}

export function findLocationByContext(xhtmlMap, context) {
  if (!xhtmlMap || !context) return null;
  const compactContext = normalizeText(context);
  if (!compactContext) return null;

  const exact = (xhtmlMap.textNodes || []).find((node) => compactContext.includes(node.text) || node.text.includes(compactContext));
  if (exact) return locationFromTextNode(exact);

  const sample = compactContext.slice(0, 80).toLowerCase();
  const fuzzy = (xhtmlMap.textNodes || []).find((node) => String(node.text || '').toLowerCase().includes(sample));
  return locationFromTextNode(fuzzy);
}

