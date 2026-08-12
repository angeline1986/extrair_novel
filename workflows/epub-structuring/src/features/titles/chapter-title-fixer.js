import path from 'node:path';
import fs from 'fs-extra';
import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readZipText } from '../../utils/zip-utils.js';
import { auditZipMimetype, writeZipFile } from '../../utils/zip-writer.js';
import { safeFileName } from '../../utils/text-utils.js';
import { analyzeChapterTitles } from './chapter-title-analyzer.js';

export async function normalizeChapterTitlesInCopy(epubPath, analysis = null, options = {}) {
  const titleAnalysis = analysis || analyzeChapterTitles(epubPath);
  if (!titleAnalysis.changed) {
    return buildReport(epubPath, null, titleAnalysis, { status: 'already_normalized', validation: null });
  }

  const epub = readEpub(epubPath);
  const outputDir = options.outputDir || path.join(process.cwd(), 'output', 'titles');
  await fs.ensureDir(outputDir);
  const outputFile = await resolveOutputFile(outputDir, epubPath);
  const itemMap = new Map(titleAnalysis.items.filter((item) => item.changed).map((item) => [item.fullPath, item]));
  const entries = buildTitlePatchedEntries(epub, itemMap, titleAnalysis.items);
  writeZipFile(outputFile, entries);
  const validation = validateTitleNormalization({ sourcePath: epubPath, outputFile, analysis: titleAnalysis });
  return buildReport(epubPath, outputFile, titleAnalysis, {
    status: validation.ok ? 'success' : 'validation_failed',
    validation
  });
}

function buildTitlePatchedEntries(epub, itemMap, allItems) {
  const entries = [];
  const navPaths = new Set(epub.navItems.map((item) => item.fullPath));
  const ncxPaths = new Set(epub.ncxItems.map((item) => item.fullPath));
  const zipEntries = epub.zip.getEntries().filter((entry) => !entry.isDirectory);
  const titleByHref = new Map(allItems.map((item) => [item.href, item.after]));
  const titleByBasename = new Map(allItems.map((item) => [path.posix.basename(item.href), item.after]));
  const mimetype = zipEntries.find((entry) => entry.entryName === 'mimetype');
  if (mimetype) entries.push({ name: 'mimetype', data: mimetype.getData(), store: true });

  for (const entry of zipEntries) {
    if (entry.entryName === 'mimetype') continue;
    let data = entry.getData();
    if (itemMap.has(entry.entryName)) {
      data = Buffer.from(patchHeading(entry.getData().toString('utf8'), itemMap.get(entry.entryName).after), 'utf8');
    } else if (navPaths.has(entry.entryName)) {
      data = Buffer.from(patchNav(entry.getData().toString('utf8'), titleByHref, titleByBasename), 'utf8');
    } else if (ncxPaths.has(entry.entryName)) {
      data = Buffer.from(patchNcx(entry.getData().toString('utf8'), titleByHref, titleByBasename), 'utf8');
    }
    entries.push({ name: entry.entryName, data });
  }
  return entries;
}

function patchHeading(html, normalizedTitle) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const heading = $('h1,h2,h3').first();
  if (heading.length) heading.text(normalizedTitle);
  const title = $('head > title').first();
  if (title.length) title.text(normalizedTitle);
  return $.xml();
}

function patchNav(xml, titleByHref, titleByBasename) {
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: false });
  $('a[href]').each((_, element) => {
    const node = $(element);
    const href = stripAnchor(node.attr('href'));
    const replacement = titleByHref.get(href) || titleByBasename.get(path.posix.basename(href));
    if (replacement) node.text(replacement);
  });
  return $.xml();
}

function patchNcx(xml, titleByHref, titleByBasename) {
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: false });
  $('navPoint').each((_, element) => {
    const node = $(element);
    const src = stripAnchor(node.find('content').first().attr('src'));
    const replacement = titleByHref.get(src) || titleByBasename.get(path.posix.basename(src));
    if (replacement) node.find('navLabel > text').first().text(replacement);
  });
  return $.xml();
}

function validateTitleNormalization({ sourcePath, outputFile, analysis }) {
  const source = readEpub(sourcePath);
  const fixed = readEpub(outputFile);
  const mimetype = auditZipMimetype(outputFile);
  const fixedAnalysis = analyzeChapterTitles(outputFile);
  const changedPaths = new Set(analysis.items.filter((item) => item.changed).map((item) => item.fullPath));
  const navPaths = new Set(source.navItems.map((item) => item.fullPath));
  const ncxPaths = new Set(source.ncxItems.map((item) => item.fullPath));
  const allowedChanged = new Set([...changedPaths, ...navPaths, ...ncxPaths]);
  const changedEntries = diffEntryData(source.zip, fixed.zip);
  const unexpectedChangedEntries = changedEntries.filter((entry) => !allowedChanged.has(entry));
  const bodyTextPreserved = analysis.items.every((item) => {
    const before = bodyNarrativeText(readZipText(source.zip, item.fullPath));
    const after = bodyNarrativeText(readZipText(fixed.zip, item.fullPath));
    return before === after;
  });
  const navSynced = navPaths.size === 0 || analysis.items.every((item) => !item.changed || navContains(fixed, item.after));
  const ncxSynced = ncxPaths.size === 0 || analysis.items.every((item) => !item.changed || ncxContains(fixed, item.after));
  const ok = mimetype.zipMimetypeOk &&
    fixedAnalysis.changed === 0 &&
    unexpectedChangedEntries.length === 0 &&
    bodyTextPreserved &&
    navSynced &&
    ncxSynced;
  return {
    ok,
    mimetype,
    changedEntries,
    unexpectedChangedEntries,
    remainingInconsistent: fixedAnalysis.changed,
    bodyTextPreserved,
    navSynced,
    ncxSynced
  };
}

function bodyNarrativeText(html) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: true });
  $('h1,h2,h3').first().remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function navContains(epub, text) {
  return epub.navItems.some((item) => readZipText(epub.zip, item.fullPath).includes(text));
}

function ncxContains(epub, text) {
  return epub.ncxItems.some((item) => readZipText(epub.zip, item.fullPath).includes(text));
}

function diffEntryData(beforeZip, afterZip) {
  const before = new Map(beforeZip.getEntries().filter((entry) => !entry.isDirectory).map((entry) => [entry.entryName, entry.getData().toString('base64')]));
  const after = new Map(afterZip.getEntries().filter((entry) => !entry.isDirectory).map((entry) => [entry.entryName, entry.getData().toString('base64')]));
  const changed = [];
  for (const [name, data] of before) {
    if (after.get(name) !== data) changed.push(name);
  }
  for (const name of after.keys()) {
    if (!before.has(name)) changed.push(name);
  }
  return changed.sort();
}

function stripAnchor(href) {
  return String(href || '').split('#')[0];
}

async function resolveOutputFile(outputDir, epubPath) {
  const parsed = path.parse(epubPath);
  const base = `${safeFileName(parsed.name)}-titles-normalized`;
  let candidate = path.join(outputDir, `${base}.epub`);
  let counter = 2;
  while (await fs.pathExists(candidate)) {
    candidate = path.join(outputDir, `${base}-${counter}.epub`);
    counter++;
  }
  return candidate;
}

function buildReport(epubPath, outputFile, analysis, result) {
  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(epubPath),
    sourcePath: epubPath,
    outputFile,
    status: result.status,
    chapterCount: analysis.chapterCount,
    changed: analysis.changed,
    unchanged: analysis.unchanged,
    items: analysis.items.filter((item) => item.changed).map((item) => ({
      chapter: item.chapter,
      href: item.href,
      before: item.before,
      after: item.after
    })),
    validation: result.validation
  };
}
