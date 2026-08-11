import fs from 'fs-extra';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { buildNavXhtml } from '../../builders/nav-builder.js';
import { buildNcx } from '../../builders/ncx-builder.js';
import { readEpub } from '../../parsers/epub-reader.js';
import { auditZipMimetype, writeZipFile } from '../../utils/zip-writer.js';
import { escapeXml } from '../../utils/xml-utils.js';
import { relativeToOpf, rewriteCssUrls } from './merge-resource-resolver.js';

const OPF_PATH = 'OEBPS/content.opf';
const NAV_PATH = 'OEBPS/nav.xhtml';
const NCX_PATH = 'OEBPS/toc.ncx';

export function buildMergedEpubFile(mergeBook, outputFile) {
  if (fs.existsSync(outputFile)) throw new Error(`OUTPUT_EXISTS: ${outputFile}`);
  fs.ensureDirSync(path.dirname(outputFile));

  const chapterReport = {
    supplementalItems: [],
    chapters: mergeBook.chapters.map((chapter) => ({
      role: 'chapter',
      chapterNumber: chapter.globalChapterNumber,
      title: chapter.title,
      finalTitle: chapter.title,
      href: path.posix.relative('OEBPS', chapter.fullPath)
    }))
  };
  const navXhtml = buildNavXhtml(chapterReport, mergeBook.metadata.language);
  const ncxXml = buildNcx(chapterReport, mergeBook.metadata);
  const opfXml = buildMergeOpf(mergeBook);
  const containerXml = buildContainerXml();

  const entries = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml, 'utf8') },
    { name: OPF_PATH, data: Buffer.from(opfXml, 'utf8') },
    { name: NAV_PATH, data: Buffer.from(navXhtml, 'utf8') },
    { name: NCX_PATH, data: Buffer.from(ncxXml, 'utf8') },
    ...mergeBook.resources.map((resource) => ({
      name: resource.fullPath,
      data: Buffer.from(resource.mediaType.includes('css')
        ? rewriteCssUrls(resource.data.toString('utf8'), resource.mapping, mergeBook.resourceMappings)
        : resource.data)
    })),
    ...mergeBook.chapters.map((chapter) => ({ name: chapter.fullPath, data: Buffer.from(chapter.xhtml, 'utf8') }))
  ];

  writeZipFile(outputFile, entries);
  const audit = auditZipMimetype(outputFile);
  if (!audit.zipMimetypeOk) throw new Error(`EPUB inválido: mimetype deve ser primeiro e STORE. ${JSON.stringify(audit)}`);
  return outputFile;
}

export function buildMergeOpf(mergeBook) {
  const metadata = mergeBook.metadata;
  const resourceItems = mergeBook.resources.map((resource) => {
    const properties = manifestPropertiesForResource(resource, mergeBook.cover?.resource);
    return `    <item id="${escapeXml(resource.id)}" href="${escapeXml(resource.href)}" media-type="${escapeXml(resource.mediaType)}"${properties ? ` properties="${escapeXml(properties)}"` : ''}/>`;
  }).join('\n');
  const chapterItems = mergeBook.chapters.map((chapter) =>
    `    <item id="chapter-${String(chapter.globalChapterNumber).padStart(3, '0')}" href="${escapeXml(relativeToOpf(chapter.fullPath))}" media-type="application/xhtml+xml"/>`
  ).join('\n');
  const spineItems = mergeBook.chapters.map((chapter) =>
    `    <itemref idref="chapter-${String(chapter.globalChapterNumber).padStart(3, '0')}"/>`
  ).join('\n');
  const coverResource = mergeBook.cover?.resource;
  const coverMeta = coverResource ? `\n    <meta name="cover" content="${escapeXml(coverResource.id)}"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${escapeXml(metadata.identifier)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.creator || '')}</dc:creator>
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    <meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${resourceItems}
${chapterItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

export function buildContainerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${OPF_PATH}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function validateMergedEpub(epubPath, mergeBook) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  return validateByReader(epubPath, mergeBook, parser);
}

function validateByReader(epubPath, mergeBook, parser) {
  const validations = [];
  const errors = [];
  const epub = readEpub(epubPath);
  const manifestPaths = new Set(epub.manifestItems.map((item) => item.fullPath));
  const spineIds = new Set(epub.spineItems.map((item) => item.idref));
  validations.push({ code: 'EPUB_REOPENS', ok: true });
  validations.push({ code: 'MIMETYPE', ok: auditZipMimetype(epubPath).zipMimetypeOk });
  validations.push({ code: 'SPINE_COUNT', ok: epub.spineItems.length === mergeBook.chapters.length, expected: mergeBook.chapters.length, actual: epub.spineItems.length });
  validations.push({ code: 'NAV_COUNT', ok: countNav(epub, parser) === mergeBook.chapters.length, expected: mergeBook.chapters.length, actual: countNav(epub, parser) });
  validations.push({ code: 'NCX_COUNT', ok: countNcx(epub, parser) === mergeBook.chapters.length, expected: mergeBook.chapters.length, actual: countNcx(epub, parser) });

  for (const chapter of mergeBook.chapters) {
    const id = `chapter-${String(chapter.globalChapterNumber).padStart(3, '0')}`;
    validations.push({ code: 'CHAPTER_IN_MANIFEST_AND_SPINE', chapter: chapter.globalChapterNumber, ok: manifestPaths.has(chapter.fullPath) && spineIds.has(id) });
  }
  for (const resource of mergeBook.resources) {
    validations.push({ code: 'RESOURCE_IN_MANIFEST', path: resource.fullPath, ok: manifestPaths.has(resource.fullPath) });
  }
  for (const result of validations) {
    if (!result.ok) errors.push(result);
  }
  return { ok: errors.length === 0, validations, errors };
}

function countNav(epub, parser) {
  const navPath = epub.navItems[0]?.fullPath;
  if (!navPath) return 0;
  const data = parser.parse(epub.zip.getEntry(navPath).getData().toString('utf8'));
  const ol = data.html?.body?.nav?.ol;
  const li = Array.isArray(ol?.li) ? ol.li : (ol?.li ? [ol.li] : []);
  return li.length;
}

function countNcx(epub, parser) {
  const ncxPath = epub.ncxItems[0]?.fullPath;
  if (!ncxPath) return 0;
  const data = parser.parse(epub.zip.getEntry(ncxPath).getData().toString('utf8'));
  const points = data.ncx?.navMap?.navPoint;
  return Array.isArray(points) ? points.length : (points ? 1 : 0);
}

function manifestPropertiesForResource(resource, coverResource) {
  const properties = String(resource.properties || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((property) => property !== 'cover-image');
  if (coverResource?.id === resource.id) properties.push('cover-image');
  return properties.join(' ');
}
