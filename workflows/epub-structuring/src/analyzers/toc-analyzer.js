import { XMLParser } from 'fast-xml-parser';
import { readZipText } from '../utils/zip-utils.js';
import { toArray } from '../utils/object-utils.js';
import { cleanText } from '../utils/text-utils.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function analyzeToc(epub) {
  const ncxItem = epub.ncxItems?.[0];
  if (!ncxItem) {
    return { hasNcx: false, hasNav: epub.navItems?.length > 0, entries: [] };
  }

  const xml = readZipText(epub.zip, ncxItem.fullPath);
  const data = parser.parse(xml);
  const navPoints = toArray(data.ncx?.navMap?.navPoint);
  const entries = flattenNavPoints(navPoints).filter((entry) => entry.src);

  return {
    hasNcx: true,
    hasNav: epub.navItems?.length > 0,
    ncxPath: ncxItem.fullPath,
    entryCount: entries.length,
    entries
  };
}

function flattenNavPoints(points, level = 1) {
  return points.flatMap((point) => {
    const entry = {
      id: point['@_id'] || '',
      playOrder: Number(point['@_playOrder'] || 0),
      level,
      label: cleanText(getLabel(point)),
      src: point.content?.['@_src'] || ''
    };
    return [entry, ...flattenNavPoints(toArray(point.navPoint), level + 1)];
  });
}

function getLabel(point) {
  const text = point.navLabel?.text;
  if (typeof text === 'object') return text['#text'] || '';
  return String(text || '').trim();
}
