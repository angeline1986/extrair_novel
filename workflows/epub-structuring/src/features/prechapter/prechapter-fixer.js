import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { readEpub } from '../../parsers/epub-reader.js';
import { readZipText } from '../../utils/zip-utils.js';
import { auditZipMimetype, writeZipFile } from '../../utils/zip-writer.js';

export async function fixPrechapterContent(epubPath, analysis, options = {}) {
  const precheck = validateFixPreconditions(analysis);
  if (!precheck.ok) {
    return buildBlockedReport(epubPath, analysis, precheck.reason);
  }

  const epub = readEpub(epubPath);
  const targetItem = findTargetItem(epub, analysis.target.href);
  if (!targetItem) {
    return buildBlockedReport(epubPath, analysis, 'target-xhtml-not-found');
  }

  const originalHashes = hashEntries(epub.zip);
  const originalHtml = readZipText(epub.zip, targetItem.fullPath);
  const patch = patchTargetXhtml(originalHtml, analysis);
  if (!patch.ok) {
    return buildBlockedReport(epubPath, analysis, patch.reason);
  }

  const outputDir = options.outputDir || path.join(process.cwd(), 'output', 'fixes');
  await fs.ensureDir(outputDir);
  const outputFile = await resolveOutputFile(outputDir, epubPath);
  const entries = buildPatchedEntries(epub.zip, targetItem.fullPath, patch.xhtml);
  writeZipFile(outputFile, entries);

  const validation = validateFixedEpub({
    outputFile,
    sourceEpub: epub,
    sourceHashes: originalHashes,
    targetFullPath: targetItem.fullPath,
    analysis,
    patch
  });

  return {
    sourceFile: path.basename(epubPath),
    sourcePath: epubPath,
    outputFile,
    status: validation.ok ? 'fixed' : 'validation_failed',
    boundarySource: analysis.boundarySource,
    confidence: analysis.confidence,
    target: analysis.target,
    preBoundary: {
      elementCount: analysis.preBoundary.elementCount,
      textElements: analysis.preBoundary.textElements
    },
    result: {
      removedElementCount: patch.removedElementCount,
      changedEntries: validation.changedEntries,
      unexpectedChangedEntries: validation.unexpectedChangedEntries,
      boundaryPreserved: validation.boundaryPreserved,
      anchorPreserved: validation.anchorPreserved,
      firstNarrativeContentPreserved: validation.firstNarrativeContentPreserved,
      preBoundaryContentRemoved: validation.preBoundaryContentRemoved,
      tocTargetValid: validation.tocTargetValid
    },
    validation,
    generatedAt: new Date().toISOString()
  };
}

export function validateFixPreconditions(analysis) {
  if (analysis?.status !== 'candidate_found') return { ok: false, reason: `status-${analysis?.status || 'missing'}` };
  if (analysis?.confidence !== 'high') return { ok: false, reason: `confidence-${analysis?.confidence || 'missing'}` };
  if (!analysis?.target?.href) return { ok: false, reason: 'missing-target-href' };
  if (!analysis?.target?.anchor && !analysis?.target?.domPath) return { ok: false, reason: 'missing-boundary-selector' };
  if (!analysis?.preBoundary?.elementCount) return { ok: false, reason: 'no-pre-boundary-content' };
  return { ok: true };
}

function patchTargetXhtml(html, analysis) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const boundary = selectBoundary($, analysis.target);
  if (!boundary) return { ok: false, reason: 'boundary-not-found' };

  const firstNarrativeAfterBoundary = findFirstFollowingText($, boundary);
  const boundaryHtmlBefore = $.html(boundary);
  const preBoundaryNodes = collectPreBoundaryNodes($, boundary);
  const nodesToRemove = preBoundaryNodes.slice(-analysis.preBoundary.elementCount);
  if (nodesToRemove.length !== analysis.preBoundary.elementCount) {
    return { ok: false, reason: 'pre-boundary-count-mismatch' };
  }

  for (const node of nodesToRemove) $(node).remove();

  return {
    ok: true,
    xhtml: $.xml(),
    removedElementCount: nodesToRemove.length,
    boundaryHtmlBefore,
    firstNarrativeAfterBoundary
  };
}

function validateFixedEpub({ outputFile, sourceEpub, sourceHashes, targetFullPath, analysis, patch }) {
  const fixedEpub = readEpub(outputFile);
  const fixedHashes = hashEntries(fixedEpub.zip);
  const changedEntries = diffHashes(sourceHashes, fixedHashes);
  const unexpectedChangedEntries = changedEntries.filter((entry) => entry !== targetFullPath);
  const fixedHtml = readZipText(fixedEpub.zip, targetFullPath);
  const $ = cheerio.load(fixedHtml, { xmlMode: true, decodeEntities: false });
  const boundary = selectBoundary($, analysis.target);
  const boundaryPreserved = Boolean(boundary);
  const anchorPreserved = analysis.target.anchor ? Boolean(findById($, analysis.target.anchor)) : true;
  const firstNarrativeContentPreserved = patch.firstNarrativeAfterBoundary ? $('body').text().includes(patch.firstNarrativeAfterBoundary) : true;
  const preBoundaryContentRemoved = (analysis.preBoundary.textElements || []).every((text) => !text || !$('body').text().includes(text));
  const tocTargetValid = validateTocTarget(fixedEpub, analysis);
  const spineUnchanged = fixedEpub.spineItems.length === sourceEpub.spineItems.length;
  const mimetype = auditZipMimetype(outputFile);

  const ok = boundaryPreserved &&
    anchorPreserved &&
    firstNarrativeContentPreserved &&
    preBoundaryContentRemoved &&
    tocTargetValid &&
    spineUnchanged &&
    unexpectedChangedEntries.length === 0 &&
    mimetype.zipMimetypeOk;

  return {
    ok,
    changedEntries,
    unexpectedChangedEntries,
    boundaryPreserved,
    anchorPreserved,
    firstNarrativeContentPreserved,
    preBoundaryContentRemoved,
    tocTargetValid,
    spineUnchanged,
    mimetype
  };
}

function buildPatchedEntries(zip, targetFullPath, patchedXhtml) {
  const entries = [];
  const zipEntries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const mimetype = zipEntries.find((entry) => entry.entryName === 'mimetype');
  if (mimetype) entries.push({ name: 'mimetype', data: mimetype.getData(), store: true });
  for (const entry of zipEntries) {
    if (entry.entryName === 'mimetype') continue;
    entries.push({
      name: entry.entryName,
      data: entry.entryName === targetFullPath ? Buffer.from(patchedXhtml, 'utf8') : entry.getData()
    });
  }
  return entries;
}

async function resolveOutputFile(outputDir, epubPath) {
  const parsed = path.parse(epubPath);
  const base = `${safeFileName(parsed.name)}-prechapter-fixed`;
  let candidate = path.join(outputDir, `${base}.epub`);
  let counter = 2;
  while (await fs.pathExists(candidate)) {
    candidate = path.join(outputDir, `${base}-${counter}.epub`);
    counter++;
  }
  return candidate;
}

function findTargetItem(epub, href) {
  return epub.manifestItems.find((item) => isHtml(item.mediaType) && (item.href === href || item.fullPath === href || path.posix.basename(item.href) === path.posix.basename(href)));
}

function selectBoundary($, target) {
  if (target.anchor) return findById($, target.anchor);
  if (target.domPath) return selectByDomPath($, target.domPath);
  return null;
}

function collectPreBoundaryNodes($, boundary) {
  const top = topLevelBodyChild(boundary);
  const nodes = [];
  let current = $(top).prev();
  while (current.length) {
    const node = current.get(0);
    if (node?.type === 'tag') nodes.unshift(node);
    current = current.prev();
  }
  return nodes;
}

function findFirstFollowingText($, boundary) {
  let current = $(topLevelBodyChild(boundary)).next();
  while (current.length) {
    const text = current.text().replace(/\s+/g, ' ').trim();
    if (text) return text;
    current = current.next();
  }
  return '';
}

function validateTocTarget(epub, analysis) {
  if (!analysis.target.anchor) return true;
  const target = findTargetItem(epub, analysis.target.href);
  if (!target) return false;
  const html = readZipText(epub.zip, target.fullPath);
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  return Boolean(findById($, analysis.target.anchor));
}

function hashEntries(zip) {
  const hashes = new Map();
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory) hashes.set(entry.entryName, sha256(entry.getData()));
  }
  return hashes;
}

function diffHashes(before, after) {
  const changed = [];
  for (const [name, hash] of before) {
    if (after.get(name) !== hash) changed.push(name);
  }
  for (const name of after.keys()) {
    if (!before.has(name)) changed.push(name);
  }
  return changed.sort();
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function topLevelBodyChild(node) {
  let current = node;
  while (current.parent && current.parent.tagName && current.parent.tagName.toLowerCase() !== 'body') {
    current = current.parent;
  }
  return current;
}

function findById($, id) {
  return $('body *').toArray().find((element) => element.attribs?.id === id) || null;
}

function selectByDomPath($, domPath) {
  try {
    return $(domPath).get(0) || null;
  } catch {
    return null;
  }
}

function buildBlockedReport(epubPath, analysis, reason) {
  return {
    sourceFile: path.basename(epubPath),
    sourcePath: epubPath,
    outputFile: null,
    status: 'blocked',
    blockReason: reason,
    boundarySource: analysis?.boundarySource || null,
    confidence: analysis?.confidence || null,
    target: analysis?.target || null,
    preBoundary: analysis?.preBoundary || null,
    result: null,
    validation: { ok: false, reason },
    generatedAt: new Date().toISOString()
  };
}

function safeFileName(value) {
  return String(value || 'epub')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'epub';
}

function isHtml(mediaType) {
  return ['application/xhtml+xml', 'text/html'].includes(mediaType);
}
