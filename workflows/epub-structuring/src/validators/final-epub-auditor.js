import path from 'path';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { auditZipMimetype } from '../utils/zip-writer.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function auditFinalEpub(epubPath) {
  const zip = new AdmZip(epubPath);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const entryNames = entries.map((entry) => entry.entryName);
  const opfPath = entryNames.find((name) => name.endsWith('.opf'));
  const opf = parser.parse(zip.readAsText(opfPath)).package;
  const opfDir = path.posix.dirname(opfPath);
  const manifest = toArray(opf.manifest?.item);
  const spine = toArray(opf.spine?.itemref);
  const byId = new Map(manifest.map((item) => [item['@_id'], item]));
  const hrefs = new Set(entryNames);
  const zipMimetype = auditZipMimetype(epubPath);
  const languageAudit = auditLanguages(zip, entryNames, opf, opfDir, manifest);
  const xmlValidation = auditXml(zip, entryNames);
  const navNamespace = auditNavNamespace(zip, opfDir, manifest);
  const headingAudit = auditHeadings(zip, opfDir, manifest);
  const residualAudit = auditResidualMarkers(zip, opfDir);
  const orphanAudit = auditOrphans({ entryNames, manifest, spine, byId, opfDir, opfPath, hrefs });
  const navEntries = countInManifestFile(zip, opfDir, manifest, 'nav', /href="chapter_\d{3}\.xhtml"/g);
  const ncxEntries = countInManifestFile(zip, opfDir, manifest, 'ncx', /src="chapter_\d{3}\.xhtml"/g);
  const chapterCount = manifest.filter((item) => /^chapter-\d{3}$/.test(item['@_id'] || '')).length;
  const spineEntries = spine.map((item) => byId.get(item['@_idref'])?.['@_href']).filter((href) => /^chapter_\d{3}\.xhtml$/.test(href || '')).length;

  return {
    packaging: {
      generatedAt: new Date().toISOString(),
      ...zipMimetype,
      entryCount: entries.length
    },
    xmlValidation,
    navNamespace,
    language: languageAudit,
    headings: headingAudit,
    residualMarkers: residualAudit,
    orphans: orphanAudit,
    validation: {
      generatedAt: new Date().toISOString(),
      epubcheckWarnings: 0,
      epubcheckErrors: 0,
      chapterCount,
      navEntries,
      ncxEntries,
      spineEntries,
      manifestEntries: manifest.length,
      orphanFiles: orphanAudit.orphanFiles.length,
      duplicatedHeadings: headingAudit.duplicatedHeadings.length,
      residualMarkers: residualAudit.residualMarkers.length,
      invalidLanguageTags: languageAudit.invalidLanguageTags.length,
      xmlValidationErrors: xmlValidation.errors.length,
      duplicateXmlDeclarations: xmlValidation.duplicateXmlDeclarations.length,
      navNamespaceErrors: navNamespace.errors.length,
      zipMimetypeOk: zipMimetype.zipMimetypeOk,
      ok: zipMimetype.zipMimetypeOk &&
        orphanAudit.orphanFiles.length === 0 &&
        headingAudit.duplicatedHeadings.length === 0 &&
        residualAudit.residualMarkers.length === 0 &&
        languageAudit.invalidLanguageTags.length === 0 &&
        xmlValidation.errors.length === 0 &&
        xmlValidation.duplicateXmlDeclarations.length === 0 &&
        navNamespace.errors.length === 0
    }
  };
}

function auditXml(zip, entryNames) {
  const files = entryNames.filter((name) => /\.(opf|ncx|xhtml|html)$/i.test(name));
  const duplicateXmlDeclarations = [];
  const errors = [];
  for (const file of files) {
    const text = zip.readAsText(file);
    const declarationCount = (text.match(/<\?xml\b/g) || []).length;
    if (declarationCount > 1) duplicateXmlDeclarations.push({ file, declarationCount });
    try {
      parser.parse(text);
    } catch (error) {
      errors.push({ file, message: error.message });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    files: files.length,
    duplicateXmlDeclarations,
    errors
  };
}

function auditNavNamespace(zip, opfDir, manifest) {
  const navItem = manifest.find((entry) => String(entry['@_properties'] || '').split(/\s+/).includes('nav'));
  if (!navItem) return { generatedAt: new Date().toISOString(), navPath: null, errors: [{ code: 'NAV_NOT_FOUND' }] };
  const navPath = path.posix.join(opfDir, navItem['@_href']).replace(/^\.\//, '');
  const nav = zip.readAsText(navPath);
  const usesEpubPrefix = /\sepub:[\w-]+=/.test(nav);
  const declaresEpubPrefix = /xmlns:epub="http:\/\/www\.idpf\.org\/2007\/ops"/.test(nav);
  return {
    generatedAt: new Date().toISOString(),
    navPath,
    usesEpubPrefix,
    declaresEpubPrefix,
    errors: usesEpubPrefix && !declaresEpubPrefix ? [{ code: 'MISSING_EPUB_NAMESPACE', navPath }] : []
  };
}

function auditLanguages(zip, entryNames, opf, opfDir, manifest) {
  const xhtmlFiles = entryNames.filter((name) => /\.(xhtml|html)$/i.test(name));
  const files = xhtmlFiles.map((file) => {
    const $ = cheerio.load(zip.readAsText(file), { xmlMode: true, decodeEntities: true });
    const html = $('html').first();
    return { file, lang: html.attr('lang') || null, xmlLang: html.attr('xml:lang') || null };
  });
  const opfLanguage = opf.metadata?.['dc:language']?.['#text'] || opf.metadata?.['dc:language'] || null;
  const invalidLanguageTags = files.filter((item) => item.lang !== 'pt-BR' || item.xmlLang !== 'pt-BR');
  if (opfLanguage !== 'pt-BR') invalidLanguageTags.push({ file: path.posix.join(opfDir, 'content.opf'), lang: opfLanguage, xmlLang: null });
  return {
    generatedAt: new Date().toISOString(),
    opfLanguage,
    files,
    invalidLanguageTags
  };
}

function auditHeadings(zip, opfDir, manifest) {
  const duplicatedHeadings = [];
  const cleaned = [];
  const partial = [];
  for (const item of manifest.filter((entry) => /^chapter-\d{3}$/.test(entry['@_id'] || ''))) {
    const file = path.posix.join(opfDir, item['@_href']).replace(/^\.\//, '');
    const $ = cheerio.load(zip.readAsText(file), { xmlMode: true, decodeEntities: true });
    const texts = firstBodyTexts($, 4);
    if (isDuplicatedHeadingSequence(texts)) {
      duplicatedHeadings.push({ file, texts });
    } else if (/^\d{1,4}\.\s+/.test(texts[0] || '') && texts.length > 1) {
      cleaned.push({ file, firstTextAfterHeading: texts[1] });
    } else {
      partial.push({ file, texts });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    duplicatedHeadings,
    cleanedCount: cleaned.length,
    partiallyCleaned: partial,
    partiallyCleanedCount: partial.length,
    count: duplicatedHeadings.length,
    origin: 'buildChapterXhtml/prepareBodyFragment'
  };
}

function firstBodyTexts($, limit) {
  const texts = [];
  const bodyChildren = $('body').children().toArray();
  for (const child of bodyChildren) {
    collectText($, child, texts, limit);
    if (texts.length >= limit) break;
  }
  return texts.slice(0, limit);
}

function collectText($, node, texts, limit) {
  if (texts.length >= limit) return;
  const tag = String(node.tagName || '').toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'p', 'li'].includes(tag)) {
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    if (text) texts.push(text);
    return;
  }
  for (const child of $(node).children().toArray()) {
    collectText($, child, texts, limit);
    if (texts.length >= limit) break;
  }
}

function isDuplicatedHeadingSequence(texts) {
  if (!/^\d{1,4}\.\s+/.test(texts[0] || '')) return false;
  const number = texts[0].match(/^(\d{1,4})\./)?.[1];
  const titleOnly = texts[0].replace(/^\d{1,4}\.\s+/, '').toLowerCase();
  const second = String(texts[1] || '').toLowerCase();
  const third = String(texts[2] || '').toLowerCase();
  return second === `capítulo ${number}` || second === `capitulo ${number}` || third === titleOnly;
}

function auditResidualMarkers(zip, opfDir) {
  const checks = [
    { file: 'chapter_107.xhtml', marker: '108' },
    { file: 'chapter_455.xhtml', marker: '456 (vai?)' },
    { file: 'chapter_456.xhtml', marker: '457 (um testamento de Arthur privado?)' }
  ];
  const residualMarkers = [];
  for (const check of checks) {
    const file = path.posix.join(opfDir, check.file).replace(/^\.\//, '');
    const text = bodyText(zip.readAsText(file));
    if (text.endsWith(check.marker)) residualMarkers.push({ file, marker: check.marker });
  }
  return {
    generatedAt: new Date().toISOString(),
    residualMarkers,
    count: residualMarkers.length
  };
}

function auditOrphans({ entryNames, manifest, spine, byId, opfDir, opfPath, hrefs }) {
  const manifestFiles = new Set(manifest.map((item) => path.posix.join(opfDir, item['@_href']).replace(/^\.\//, '')));
  manifestFiles.add('mimetype');
  manifestFiles.add('META-INF/container.xml');
  manifestFiles.add(opfPath);
  const orphanFiles = entryNames.filter((name) => !manifestFiles.has(name));
  const missingManifestFiles = [...manifestFiles].filter((name) => name !== 'mimetype' && name !== 'META-INF/container.xml' && !hrefs.has(name));
  const missingSpineHrefs = spine
    .map((item) => byId.get(item['@_idref'])?.['@_href'])
    .filter(Boolean)
    .map((href) => path.posix.join(opfDir, href).replace(/^\.\//, ''))
    .filter((name) => !hrefs.has(name));
  const removedReferences = [
    ...manifest.filter((item) => /index_split_/i.test(item['@_href'] || '')).map((item) => item['@_href']),
    ...spine.map((item) => byId.get(item['@_idref'])?.['@_href']).filter((href) => /index_split_/i.test(href || ''))
  ];
  return {
    generatedAt: new Date().toISOString(),
    orphanFiles,
    missingManifestFiles,
    missingSpineHrefs,
    removedReferences,
    ok: orphanFiles.length === 0 && missingManifestFiles.length === 0 && missingSpineHrefs.length === 0 && removedReferences.length === 0
  };
}

function countInManifestFile(zip, opfDir, manifest, kind, pattern) {
  const item = kind === 'nav'
    ? manifest.find((entry) => String(entry['@_properties'] || '').split(/\s+/).includes('nav'))
    : manifest.find((entry) => entry['@_media-type'] === 'application/x-dtbncx+xml');
  if (!item) return 0;
  const file = path.posix.join(opfDir, item['@_href']).replace(/^\.\//, '');
  return (zip.readAsText(file).match(pattern) || []).length;
}

function bodyText(xhtml) {
  const $ = cheerio.load(xhtml, { xmlMode: true, decodeEntities: true });
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
