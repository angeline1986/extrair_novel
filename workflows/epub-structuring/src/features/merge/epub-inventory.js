import crypto from 'node:crypto';
import path from 'node:path';
import { readEpub } from '../../parsers/epub-reader.js';
import { detectSourceRange } from './source-range-detector.js';

const RESOURCE_TYPES = {
  images: /^image\//,
  stylesheets: /css/,
  fonts: /font|opentype|truetype/
};

export function inventoryEpubSource(epubPath) {
  const epub = readEpub(epubPath);
  const range = detectSourceRange(epub, epubPath);
  const resources = inventoryResources(epub);
  const cover = detectCover(epub, resources.entries);

  return {
    sourceFile: path.basename(epubPath),
    sourcePath: epubPath,
    ...range,
    language: epub.opf.metadata.language || null,
    title: epub.opf.metadata.title || null,
    author: epub.opf.metadata.creator || null,
    publisher: epub.opf.metadata.publisher || null,
    identifier: epub.opf.metadata.identifier || null,
    navigation: {
      hasNcx: epub.ncxItems.length > 0,
      hasNav: epub.navItems.length > 0,
      spineCount: epub.spineItems.length,
      htmlCount: epub.htmlItems.length
    },
    cover,
    resources: {
      images: resources.images,
      stylesheets: resources.stylesheets,
      fonts: resources.fonts,
      entries: resources.entries
    },
    structuralIssues: range.issues || []
  };
}

function inventoryResources(epub) {
  const entries = epub.manifestItems
    .filter((item) => isResource(item.mediaType))
    .map((item) => {
      const entry = epub.zip.getEntry(item.fullPath);
      const data = entry ? entry.getData() : Buffer.from('');
      return {
        id: item.id,
        href: item.href,
        fullPath: item.fullPath,
        mediaType: item.mediaType,
        properties: item.properties || '',
        hash: sha256(data)
      };
    });
  return {
    images: entries.filter((entry) => RESOURCE_TYPES.images.test(entry.mediaType)).length,
    stylesheets: entries.filter((entry) => RESOURCE_TYPES.stylesheets.test(entry.mediaType)).length,
    fonts: entries.filter((entry) => RESOURCE_TYPES.fonts.test(entry.mediaType)).length,
    entries
  };
}

function detectCover(epub, resources) {
  const coverItem = resources.find((item) => String(item.properties).split(/\s+/).includes('cover-image')) ||
    resources.find((item) => /cover/i.test(`${item.id} ${item.href}`));
  if (!coverItem) return { path: null, hash: null };
  return { path: coverItem.fullPath, hash: coverItem.hash };
}

function isResource(mediaType) {
  return RESOURCE_TYPES.images.test(mediaType) || RESOURCE_TYPES.stylesheets.test(mediaType) || RESOURCE_TYPES.fonts.test(mediaType);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
