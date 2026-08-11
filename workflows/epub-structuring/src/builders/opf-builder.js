import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { toArray } from '../utils/object-utils.js';
import { normalizeLanguageTag } from '../utils/language-utils.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true, suppressEmptyNode: true });

export function buildEpub3Opf(epub, navHref, ncxHref, updatedChapterReport) {
  const data = parser.parse(epub.opf.xml);
  const pkg = data.package;
  pkg['@_version'] = '3.0';
  normalizeMetadataLanguage(pkg, epub.opf.metadata.language);
  normalizeEpub3Metadata(pkg);
  delete pkg.guide;
  pkg.manifest = pkg.manifest || {};
  const items = toArray(pkg.manifest.item);
  ensureManifestItem(items, { id: 'nav', href: navHref, mediaType: 'application/xhtml+xml', properties: 'nav' });
  ensureManifestItem(items, { id: 'ncx', href: ncxHref, mediaType: 'application/x-dtbncx+xml' });

  for (const item of updatedChapterReport.supplementalItems || []) {
    ensureManifestItem(items, {
      id: supplementalId(item),
      href: item.href,
      mediaType: 'application/xhtml+xml'
    });
  }

  // Adicionar chapter_XXX.xhtml ao manifest (não remover index_split_XXX.html)
  for (const chapter of updatedChapterReport.chapters) {
    if (chapter.role === 'chapter') {
      ensureManifestItem(items, {
        id: `chapter-${String(chapter.chapterNumber).padStart(3, '0')}`,
        href: chapter.href,
        mediaType: 'application/xhtml+xml'
      });
    }
  }

  pkg.manifest.item = removeUnusedHtmlItems(items, updatedChapterReport, navHref, ncxHref).map((item) => cleanItem(item));
  pkg.spine = pkg.spine || {};
  pkg.spine['@_toc'] = findIdByHref(pkg.manifest.item, ncxHref) || 'ncx';

  // Reconstruir spine usando frontmatter de chapterReport + novos capítulos
  // index_split_XXX.html antigos não entram no spine
  const supplementalItems = (updatedChapterReport.supplementalItems || []).map(item => ({
    '@_idref': supplementalId(item)
  }));

  const chapterDocs = updatedChapterReport.chapters.filter(ch => ch.role === 'chapter');
  const chapterItems = chapterDocs.map(chapter => ({
    '@_idref': `chapter-${String(chapter.chapterNumber).padStart(3, '0')}`
  }));

  pkg.spine.itemref = [...supplementalItems, ...chapterItems];
  return withSingleXmlDeclaration(builder.build(data));
}

function supplementalId(item) {
  return `supplemental-${String(item.role || item.title || item.href).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}`;
}

function ensureManifestItem(items, expected) {
  const found = items.find((item) => item['@_href'] === expected.href || item['@_id'] === expected.id);
  if (found) {
    found['@_media-type'] = expected.mediaType;
    if (expected.properties) found['@_properties'] = expected.properties;
    return;
  }
  items.push({ '@_id': expected.id, '@_href': expected.href, '@_media-type': expected.mediaType, ...(expected.properties ? { '@_properties': expected.properties } : {}) });
}

function findIdByHref(items, href) {
  return toArray(items).find((item) => item['@_href'] === href)?.['@_id'];
}

function cleanItem(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined && value !== null));
}

function removeUnusedHtmlItems(items, updatedChapterReport, navHref, ncxHref) {
  const allowedHtmlHrefs = new Set([
    navHref,
    ncxHref,
    ...(updatedChapterReport.supplementalItems || []).map((item) => item.href),
    ...updatedChapterReport.chapters.filter((chapter) => chapter.role === 'chapter').map((chapter) => chapter.href)
  ]);

  return items.filter((item) => {
    const mediaType = item['@_media-type'];
    if (!['application/xhtml+xml', 'text/html'].includes(mediaType)) return true;
    return allowedHtmlHrefs.has(item['@_href']);
  });
}

function normalizeMetadataLanguage(pkg, fallbackLanguage) {
  pkg.metadata = pkg.metadata || {};
  const normalized = normalizeLanguageTag(fallbackLanguage || pkg.metadata['dc:language'] || 'pt-BR');
  const current = pkg.metadata['dc:language'];
  if (Array.isArray(current)) {
    pkg.metadata['dc:language'] = current.length ? [normalized, ...current.slice(1)] : [normalized];
  } else if (current && typeof current === 'object') {
    pkg.metadata['dc:language'] = { ...current, '#text': normalized };
  } else {
    pkg.metadata['dc:language'] = normalized;
  }
}

function normalizeEpub3Metadata(pkg) {
  pkg.metadata = pkg.metadata || {};
  removeAttributeDeep(pkg.metadata, '@_opf:scheme');
  removeAttributeDeep(pkg.metadata, '@_opf:role');
  const metas = toArray(pkg.metadata.meta)
    .filter((meta) => meta?.['@_property'] !== 'dcterms:modified');
  metas.push({
    '@_property': 'dcterms:modified',
    '#text': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  });
  pkg.metadata.meta = metas;
}

function removeAttributeDeep(value, attrName) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) removeAttributeDeep(item, attrName);
    return;
  }
  delete value[attrName];
  for (const child of Object.values(value)) removeAttributeDeep(child, attrName);
}

function withSingleXmlDeclaration(xml) {
  const body = String(xml || '').replace(/^\s*(<\?xml[^?]*\?>\s*)+/i, '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
