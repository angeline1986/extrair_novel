import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { toArray } from '../utils/object-utils.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true, suppressEmptyNode: true });

export function buildEpub3Opf(epub, navHref, ncxHref, updatedChapterReport) {
  const data = parser.parse(epub.opf.xml);
  const pkg = data.package;
  pkg['@_version'] = '3.0';
  pkg.manifest = pkg.manifest || {};
  const items = toArray(pkg.manifest.item);
  ensureManifestItem(items, { id: 'nav', href: navHref, mediaType: 'application/xhtml+xml', properties: 'nav' });
  ensureManifestItem(items, { id: 'ncx', href: ncxHref, mediaType: 'application/x-dtbncx+xml' });

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

  pkg.manifest.item = items.map((item) => cleanItem(item));
  pkg.spine = pkg.spine || {};
  pkg.spine['@_toc'] = findIdByHref(pkg.manifest.item, ncxHref) || 'ncx';

  // Reconstruir spine usando frontmatter de chapterReport + novos capítulos
  // index_split_XXX.html antigos não entram no spine
  const frontmatterDocs = updatedChapterReport.documents.filter(doc => doc.role === 'frontmatter');
  const frontmatterItems = frontmatterDocs.map(doc => {
    const id = findIdByHref(items, doc.href) || doc.idref;
    return { '@_idref': id };
  });

  const chapterDocs = updatedChapterReport.chapters.filter(ch => ch.role === 'chapter');
  const chapterItems = chapterDocs.map(chapter => ({
    '@_idref': `chapter-${String(chapter.chapterNumber).padStart(3, '0')}`
  }));

  pkg.spine.itemref = [...frontmatterItems, ...chapterItems];
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(data)}`;
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
