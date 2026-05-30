import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { normalizeZipPath, readZipText } from '../utils/zip-utils.js';
import { toArray } from '../utils/object-utils.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function readEpub(epubPath) {
  const zip = new AdmZip(epubPath);
  const container = readContainer(zip);
  const opf = readOpf(zip, container.rootfilePath);
  const opfDir = path.posix.dirname(container.rootfilePath);
  const manifestItems = getManifestItems(opf.raw, opfDir);
  const spineItems = getSpineItems(opf.raw, manifestItems);
  const htmlItems = manifestItems.filter((item) => isHtml(item.mediaType));
  const ncxItems = manifestItems.filter((item) => item.mediaType === 'application/x-dtbncx+xml');
  const navItems = manifestItems.filter((item) => item.properties.includes('nav'));

  return { sourcePath: epubPath, zip, container, opf: { ...opf, directory: opfDir },
    manifestItems, spineItems, htmlItems, ncxItems, navItems };
}

function readContainer(zip) {
  const data = parser.parse(readZipText(zip, 'META-INF/container.xml'));
  const rootfile = toArray(data.container?.rootfiles?.rootfile).find((item) => item['@_full-path']);
  if (!rootfile) throw new Error('container.xml não possui rootfile válido.');

  return {
    rootfilePath: normalizeZipPath(rootfile['@_full-path']),
    mediaType: rootfile['@_media-type'] || ''
  };
}

function readOpf(zip, opfPath) {
  const xml = readZipText(zip, opfPath);
  const data = parser.parse(xml);
  const pkg = data.package;
  if (!pkg) throw new Error('OPF inválido: elemento package ausente.');

  return {
    path: opfPath,
    xml,
    raw: pkg,
    version: pkg['@_version'] || '',
    uniqueIdentifier: pkg['@_unique-identifier'] || '',
    metadata: parseMetadata(pkg.metadata || {})
  };
}

function parseMetadata(metadata) {
  return {
    title: textValue(metadata['dc:title']),
    creator: textValue(metadata['dc:creator']),
    language: textValue(metadata['dc:language']),
    identifier: textValue(metadata['dc:identifier']),
    publisher: textValue(metadata['dc:publisher'])
  };
}

function getManifestItems(pkg, opfDir) {
  return toArray(pkg.manifest?.item).map((item) => ({
    id: item['@_id'] || '',
    href: item['@_href'] || '',
    fullPath: normalizeZipPath(path.posix.join(opfDir, item['@_href'] || '')),
    mediaType: item['@_media-type'] || '',
    properties: item['@_properties'] || ''
  }));
}

function getSpineItems(pkg, manifestItems) {
  const byId = new Map(manifestItems.map((item) => [item.id, item]));

  return toArray(pkg.spine?.itemref).map((itemref, index) => {
    const item = byId.get(itemref['@_idref'] || '');
    return {
      index,
      idref: itemref['@_idref'] || '',
      linear: itemref['@_linear'] || 'yes',
      href: item?.href || '',
      fullPath: item?.fullPath || '',
      mediaType: item?.mediaType || ''
    };
  });
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}

function textValue(value) {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return '';
  if (typeof first === 'object') return first['#text'] || '';
  return String(first);
}
