#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
import { readEpubFile } from './epubReader.js';
import { resolveEpubTarget } from './epubTargetResolver.js';
import { readManifest, sanitizeManifest } from './manifestUtils.js';
import { refreshPdfEpubReviewQueueSummary } from './pdfEpubReviewQueue.js';
import { ensureStateDirs, pdfEpubStatePath, statePaths } from './statePaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');

const paths = {
  inputFixedDir: path.join(workflowRoot, 'input-fixed'),
  outputDir: path.join(workflowRoot, 'output'),
  manifestPath: path.join(workflowRoot, 'input-fixed/manifest.json'),
  reviewQueuePath: statePaths.pdfEpub.reviewQueue,
  applicationReportPath: statePaths.pdfEpub.applicationReport,
  workflowEventsPath: path.join(workflowRoot, 'logs/workflow-events.jsonl'),
};

function ensureDirs() {
  ensureStateDirs();
  for (const dir of [paths.inputFixedDir, paths.outputDir, path.dirname(paths.workflowEventsPath)]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function relativeWorkflowPath(filePath) {
  if (!filePath) return null;
  const relative = path.relative(workflowRoot, filePath).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : filePath;
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadManifest() {
  return readManifest(paths.manifestPath, workflowRoot);
}

function saveManifest(manifest) {
  writeJson(paths.manifestPath, sanitizeManifest(manifest, workflowRoot));
}

function nextVersionDir() {
  ensureDirs();
  const versions = fs.readdirSync(paths.inputFixedDir)
    .map((name) => name.match(/^v(\d+)$/i))
    .filter(Boolean)
    .filter((match) => {
      const dir = path.join(paths.inputFixedDir, match[0]);
      return fs.readdirSync(dir).some((filename) => /\.epub$/i.test(filename));
    })
    .map((match) => Number(match[1]));

  const next = versions.length ? Math.max(...versions) + 1 : 1;
  const dir = path.join(paths.inputFixedDir, `v${next}`);
  fs.mkdirSync(dir, { recursive: true });
  return { version: `v${next}`, numericVersion: next, dir };
}

function appendWorkflowEvent(event, payload = {}) {
  const entry = {
    time: new Date().toISOString(),
    event,
    ...payload,
  };
  fs.appendFileSync(paths.workflowEventsPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacementRegex(from) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedRegex(from)})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
}

function replaceText(text, from, to) {
  const regex = replacementRegex(from);
  let count = 0;
  const nextText = String(text || '').replace(regex, (match, prefix) => {
    count += 1;
    return `${prefix}${to}`;
  });
  return { text: nextText, count };
}

function occurrenceRange(text, term, occurrenceIndex = 0) {
  const matches = [...String(text || '').matchAll(replacementRegex(term))];
  const match = matches[occurrenceIndex];
  if (!match) return null;
  const start = (match.index || 0) + match[1].length;
  return { start, end: start + match[2].length };
}

function contextRange(text, context) {
  const source = String(context || '').trim();
  if (!source) return null;
  const pattern = source
    .split(/\s+/)
    .map(escapedRegex)
    .join('\\s+');
  const match = String(text || '').match(new RegExp(pattern, 'u'));
  if (!match) return null;
  return { start: match.index || 0, end: (match.index || 0) + match[0].length };
}

function scopedReplacementRange(text, replacement) {
  const scope = replacement.scope;
  if (!scope?.context) return null;
  const context = bestContextCandidate(
    text,
    scope.context,
    replacement.from,
    scope.occurrenceIndex || 0
  );
  if (!context) return null;
  const localText = String(text || '').slice(context.start, context.end);
  const localRange = occurrenceRange(localText, replacement.from, scope.occurrenceIndex || 0);
  if (!localRange) return null;
  return {
    start: context.start + localRange.start,
    end: context.start + localRange.end,
    similarity: context.similarity ?? 1,
  };
}

export function replaceScopedText(text, replacements) {
  const planned = replacements
    .map((replacement) => ({ replacement, range: scopedReplacementRange(text, replacement) }))
    .filter((item) => item.range)
    .sort((a, b) => b.range.start - a.range.start);
  let nextText = String(text || '');
  const changes = [];
  const changesByRange = new Map();

  for (const { replacement, range } of planned) {
    const rangeKey = `${range.start}:${range.end}`;
    const existingChange = changesByRange.get(rangeKey);
    if (existingChange) {
      if (existingChange.to === replacement.to) {
        existingChange.reviewQueueItemIds = [...new Set([
          ...(existingChange.reviewQueueItemIds || []),
          ...(replacement.reviewQueueItemIds || []),
          replacement.reviewQueueItemId,
        ].filter(Boolean))];
      }
      continue;
    }
    nextText = `${nextText.slice(0, range.start)}${replacement.to}${nextText.slice(range.end)}`;
    const change = {
      reviewQueueItemId: replacement.reviewQueueItemId,
      reviewQueueItemIds: replacement.reviewQueueItemIds,
      from: replacement.from,
      to: replacement.to,
      count: 1,
      occurrenceIndex: replacement.scope.occurrenceIndex,
      context: replacement.scope.context,
    };
    changesByRange.set(rangeKey, change);
    changes.push(change);
  }
  return { text: nextText, changes };
}

function quotedRecommendation(value) {
  const match = String(value || '').match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function capitalizeTitle(value) {
  return String(value || '').replace(/^(\s*)(\p{L})/u, (match, prefix, first) => `${prefix}${first.toLocaleUpperCase('pt-BR')}`);
}

function cleanTitleRecommendation(value) {
  return capitalizeTitle(String(value || '')
    .split(';')[0]
    .replace(/,\s*se o cap[ií]tulo\b.*$/iu, '')
    .replace(/\bconforme\b.*$/iu, '')
    .replace(/\bconfirmar\b.*$/iu, '')
    .trim());
}

function stripChapterPrefix(value) {
  return String(value || '').replace(/^\s*\d+[.)]?\s*/, '').trim();
}

function titleReplacement(item) {
  const recommended = cleanTitleRecommendation(quotedRecommendation(item.recommendation) || item.recommendation);
  if (!recommended || !item.translation || !/titulo|título/i.test(item.location || item.type || '')) return null;

  const chapter = String(item.chapter || '').trim();
  const titleOnly = stripChapterPrefix(item.translation);
  const recommendedOnly = stripChapterPrefix(recommended);
  if (!titleOnly || !recommendedOnly || titleOnly === recommendedOnly) return null;

  return {
    from: item.translation,
    to: chapter && /^\d+$/.test(chapter) ? `${chapter}. ${recommendedOnly}` : recommendedOnly,
  };
}

function reviewReplacement(item) {
  if (!item.review?.replacement?.from || !item.review?.replacement?.to) return null;

  const from = String(item.review.replacement.from).trim();
  let to = String(item.review.replacement.to).trim();
  if (!from || !to) return null;

  if (/titulo|título/i.test(`${item.location || ''} ${item.type || ''}`)) {
    const chapterMatch = from.match(/^(\d+[.)]\s*)/);
    const titleOnly = stripChapterPrefix(cleanTitleRecommendation(to));
    to = chapterMatch && titleOnly ? `${chapterMatch[1]}${titleOnly}` : titleOnly;
  }

  if (!to || from === to) return null;
  return { from, to, scope: item.review?.scope || null };
}

function termReplacement(item) {
  const from = item.problematicTerm || item.sourceTerm || item.original;
  const to = quotedRecommendation(item.recommendation) || item.recommendation;
  if (!from || !to) return null;
  if (String(from).trim() === String(to).trim()) return null;
  if (String(to).length > 80) return null;
  return { from: String(from).trim(), to: String(to).trim() };
}

function replacementFromItem(item) {
  const reviewed = reviewReplacement(item);
  if (reviewed) return reviewed;
  return titleReplacement(item) || termReplacement(item);
}

function chapterEntryMap(epubDoc) {
  return new Map((epubDoc.sections || []).map((section) => [
    String(section.chapterNumber || section.index + 1),
    section.path,
  ]));
}

function approvedReplacements(queue, entriesByChapter = new Map()) {
  const replacements = [];
  const skipped = [];
  const seen = new Map();

  for (const item of queue.items || []) {
    if (item.status !== 'approved') continue;
    if (item.application?.finalPath || item.application?.appliedAt) {
      skipped.push({ id: item.id, reason: 'approved_item_already_applied' });
      continue;
    }
    const replacement = replacementFromItem(item);
    if (!replacement) {
      skipped.push({ id: item.id, reason: 'no_clear_replacement' });
      continue;
    }
    const key = [
      entriesByChapter.get(String(item.chapter)) || '',
      replacement.from,
      replacement.to,
      replacement.scope?.context || '',
      replacement.scope?.occurrenceIndex ?? '',
    ].join('\u0000');
    const duplicate = seen.get(key);
    if (duplicate) {
      duplicate.reviewQueueItemIds.push(item.id);
      continue;
    }
    const queuedReplacement = {
      ...replacement,
      entry: entriesByChapter.get(String(item.chapter)) || null,
      reviewQueueItemId: item.id,
      reviewQueueItemIds: [item.id],
    };
    seen.set(key, queuedReplacement);
    replacements.push(queuedReplacement);
  }

  return { replacements, skipped };
}

function scopedReplacementAlreadyPresent(html, replacement) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const candidates = $.root().find('*').addBack().contents().toArray()
    .filter((node) => node.type === 'text' && node.data?.trim())
    .map((node) => {
      const candidate = bestContextCandidate(node.data, replacement.scope.context);
      if (!candidate) return null;
      const candidateText = node.data.slice(candidate.start, candidate.end);
      const oldTermStillPresent = occurrenceRange(
        candidateText,
        replacement.from,
        replacement.scope.occurrenceIndex || 0
      );
      const newTermPresent = occurrenceRange(candidateText, replacement.to, 0);
      return !oldTermStillPresent && newTermPresent ? candidate : null;
    })
    .filter((candidate) => candidate?.similarity >= 0.8)
    .sort((a, b) => b.similarity - a.similarity);
  return Boolean(candidates[0]);
}

function reconcilePendingApprovedItems(queue, zip, entriesByChapter, targetPath) {
  const now = new Date().toISOString();
  let reconciled = 0;
  for (const item of queue.items || []) {
    if (item.status !== 'approved') continue;
    if (item.application?.finalPath || item.application?.appliedAt) continue;
    const replacement = replacementFromItem(item);
    const entryName = entriesByChapter.get(String(item.chapter));
    if (!replacement?.scope?.context || !entryName) continue;
    const entry = zip.getEntry(entryName);
    if (!entry || !scopedReplacementAlreadyPresent(entry.getData().toString('utf8'), replacement)) {
      continue;
    }
    item.application = {
      appliedAt: now,
      version: null,
      finalPath: relativeWorkflowPath(targetPath),
      inferred: true,
      replacement,
    };
    item.updatedAt = now;
    reconciled += 1;
  }
  if (reconciled) refreshPdfEpubReviewQueueSummary(queue);
  return reconciled;
}

function shouldEditEntry(entryName) {
  return /\.(xhtml|html|htm|xml|opf|ncx)$/i.test(entryName);
}

function cleanupGeneratedTitleText(text) {
  const value = String(text || '');
  const compactValue = value.replace(/\s+/g, ' ').trim();
  const artifactMatch = compactValue.match(/^(\d+[.)]\s*)(.+?)(?:;\s*confirmar\b.*|,\s*se o cap[ií]tulo\b.*)$/iu);
  if (artifactMatch) return `${artifactMatch[1]}${capitalizeTitle(artifactMatch[2].trim())}`;

  const lowercaseTitleMatch = compactValue.match(/^(\d+[.)]\s*)(\p{Ll}.*)$/u);
  if (lowercaseTitleMatch && compactValue.length <= 80) {
    return `${lowercaseTitleMatch[1]}${capitalizeTitle(lowercaseTitleMatch[2])}`;
  }

  return null;
}

function comparableTokens(value) {
  return new Set(String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/\p{L}+/gu) || []);
}

function tokenSimilarity(left, right) {
  const a = comparableTokens(left);
  const b = comparableTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / b.size;
}

function sentenceRanges(text) {
  const ranges = [];
  const pattern = /[^.!?…]+(?:[.!?…]+|$)/gu;
  for (const match of String(text || '').matchAll(pattern)) {
    const raw = match[0];
    const leading = raw.match(/^\s*/u)?.[0].length || 0;
    const trailing = raw.match(/\s*$/u)?.[0].length || 0;
    ranges.push({
      start: (match.index || 0) + leading,
      end: (match.index || 0) + raw.length - trailing,
      text: raw.slice(leading, raw.length - trailing),
    });
  }
  return ranges;
}

function bestContextCandidate(text, context, term = '', occurrenceIndex = 0) {
  const exact = contextRange(text, context);
  if (exact) {
    const exactText = String(text || '').slice(exact.start, exact.end);
    if (!term || occurrenceRange(exactText, term, occurrenceIndex)) {
      return { ...exact, similarity: 1 };
    }
  }
  const candidates = sentenceRanges(text)
    .filter((range) => !term || occurrenceRange(range.text, term, occurrenceIndex))
    .map((range) => ({ ...range, similarity: tokenSimilarity(range.text, context) }))
    .sort((a, b) => b.similarity - a.similarity);
  return candidates[0]?.similarity >= 0.5 ? candidates[0] : null;
}

function replaceContextCorrections(text, corrections) {
  const planned = corrections
    .map((correction) => ({ correction, range: bestContextCandidate(text, correction.from) }))
    .filter((item) => item.range)
    .sort((a, b) => b.range.start - a.range.start);
  let nextText = String(text || '');
  const changes = [];

  for (const { correction, range } of planned) {
    nextText = `${nextText.slice(0, range.start)}${correction.to}${nextText.slice(range.end)}`;
    for (const reviewQueueItemId of correction.reviewQueueItemIds || []) {
      changes.push({
        reviewQueueItemId,
        from: correction.from,
        to: correction.to,
        count: 1,
        contextCorrection: true,
      });
    }
  }
  return { text: nextText, changes };
}

function replacementAlreadyPresent(zip, replacement) {
  if (replacement.contextCorrection) {
    return zip.getEntries().some((entry) =>
      !entry.isDirectory
      && shouldEditEntry(entry.entryName)
      && contextRange(entry.getData().toString('utf8'), replacement.to)
    );
  }
  if (replacement.scope?.context) {
    const expectedContext = replaceScopedText(replacement.scope.context, [replacement]).text;
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !shouldEditEntry(entry.entryName)) continue;
      const text = entry.getData().toString('utf8');
      if (contextRange(text, replacement.scope.context)) return false;
      if (contextRange(text, expectedContext)) return true;
    }
    return false;
  }
  let foundBefore = false;
  let foundAfter = false;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !shouldEditEntry(entry.entryName)) continue;
    const text = entry.getData().toString('utf8');
    if (replacementRegex(replacement.from).test(text)) foundBefore = true;
    if (replacementRegex(replacement.to).test(text)) foundAfter = true;
    if (foundBefore) return false;
  }

  return foundAfter;
}

function replacementsAlreadyApplied(zip, replacements) {
  return replacements.length > 0 && replacements.every((replacement) => replacementAlreadyPresent(zip, replacement));
}

export function reconcileApprovedPdfEpubApplications() {
  const queuePath = pdfEpubStatePath('reviewQueue');
  const queue = readJson(queuePath);
  if (!queue) return { reconciled: 0 };

  const target = resolveEpubTarget({ workflowRoot });
  const sourceEpub = readEpubFile(target.filePath);
  const zip = new AdmZip(target.filePath);
  const reconciled = reconcilePendingApprovedItems(
    queue,
    zip,
    chapterEntryMap(sourceEpub),
    target.filePath
  );

  if (reconciled) {
    writeJson(paths.reviewQueuePath, queue);
  }

  return { reconciled };
}

function updateXmlText(html, replacements, entryName = '') {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const changes = [];
  const entryReplacements = replacements.filter((replacement) =>
    !replacement.entry || replacement.entry === entryName
  );

  $('script, style').remove();
  const textNodes = $.root().find('*').addBack().contents().toArray()
    .filter((node) => node.type === 'text' && node.data?.trim());
  const scopedAssignments = new Map();
  const scoped = entryReplacements.filter((replacement) =>
    replacement.scope?.context && !replacement.contextCorrection
  );
  for (const replacement of scoped) {
    const candidates = textNodes
      .map((node) => ({ node, range: scopedReplacementRange(node.data, replacement) }))
      .filter((candidate) => candidate.range)
      .sort((a, b) => b.range.similarity - a.range.similarity);
    const selected = candidates[0];
    if (!selected) continue;
    if (!scopedAssignments.has(selected.node)) scopedAssignments.set(selected.node, []);
    scopedAssignments.get(selected.node).push(replacement);
  }

  for (const node of textNodes) {
    if (node.type !== 'text') continue;
    if (!node.data || !node.data.trim()) continue;

    let text = node.data;
    const cleanedTitle = cleanupGeneratedTitleText(text);
    if (cleanedTitle && cleanedTitle !== text.trim()) {
      changes.push({
        reviewQueueItemId: null,
        from: text,
        to: cleanedTitle,
        count: 1,
        source: 'title_cleanup',
      });
      text = cleanedTitle;
    }

    const contextCorrections = entryReplacements.filter((replacement) => replacement.contextCorrection);
    const contextResult = replaceContextCorrections(text, contextCorrections);
    text = contextResult.text;
    changes.push(...contextResult.changes);

    const global = entryReplacements.filter((replacement) => !replacement.scope?.context && !replacement.contextCorrection);
    const scopedResult = replaceScopedText(text, scopedAssignments.get(node) || []);
    text = scopedResult.text;
    changes.push(...scopedResult.changes);

    for (const replacement of global) {
      const result = replaceText(text, replacement.from, replacement.to);
      if (result.count > 0) {
        changes.push({
          reviewQueueItemId: replacement.reviewQueueItemId,
          from: replacement.from,
          to: replacement.to,
          count: result.count,
        });
        text = result.text;
      }
    }
    node.data = text;
  }

  return { html: $.xml(), changes };
}

function writeEpubZip(zip, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    const entries = zip.getEntries();
    const mimetype = entries.find((entry) => entry.entryName === 'mimetype');

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(
      mimetype ? mimetype.getData() : Buffer.from('application/epub+zip'),
      { name: 'mimetype', store: true }
    );

    for (const entry of entries) {
      if (entry.entryName === 'mimetype' || entry.isDirectory) continue;
      archive.append(entry.getData(), { name: entry.entryName });
    }

    archive.finalize();
  });
}

function validateGeneratedEpub(filePath, expectedChanges, expectedEntries) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const epubDoc = readEpubFile(filePath);
  const scopedChanges = expectedChanges.filter((change) => change.context);
  const unresolvedScopedChanges = [];
  const entriesByName = new Map(entries.map((entry) => [entry.entryName, entry]));

  for (const [entryName, expectedHtml] of expectedEntries.entries()) {
    const actualHtml = entriesByName.get(entryName)?.getData().toString('utf8');
    if (actualHtml === expectedHtml) continue;
    unresolvedScopedChanges.push(...expectedChanges
      .filter((change) => change.entry === entryName && change.context)
      .map((change) => ({
        reviewQueueItemId: change.reviewQueueItemId,
        reviewQueueItemIds: change.reviewQueueItemIds,
        from: change.from,
        to: change.to,
        occurrenceIndex: change.occurrenceIndex,
        entry: entryName,
      })));
  }

  return {
    zipReadable: entries.length > 0,
    hasMimetype: entries.some((entry) => entry.entryName === 'mimetype'),
    hasContainer: entries.some((entry) => entry.entryName === 'META-INF/container.xml'),
    sections: epubDoc.sections?.length || 0,
    paragraphs: epubDoc.paragraphCount || 0,
    scopedChanges: scopedChanges.length,
    unresolvedScopedChanges,
    valid: entries.length > 0
      && entries.some((entry) => entry.entryName === 'mimetype')
      && entries.some((entry) => entry.entryName === 'META-INF/container.xml')
      && !unresolvedScopedChanges.length,
  };
}

function updateManifest({ version, numericVersion, sourcePath, versionPath, finalPath, report }) {
  const manifest = loadManifest();
  manifest.currentVersion = numericVersion;
  manifest.currentPath = 'output';
  manifest.finalOutput = 'output';
  manifest.versions = [
    ...(manifest.versions || []).filter((item) => Number(item.version) !== numericVersion),
    {
      version: numericVersion,
      source: relativeWorkflowPath(sourcePath),
      output: relativeWorkflowPath(path.dirname(versionPath)),
      file: path.basename(versionPath),
      finalFile: path.basename(finalPath),
      createdAt: report.timestamp,
      step: numericVersion,
      metadata: {
        source: 'pdf_epub_review_queue',
        approvedItems: report.approvedItems,
        replacementsApplied: report.totalReplacements,
        changedEntries: report.changedEntries.length,
      },
    },
  ].sort((a, b) => Number(a.version) - Number(b.version));
  saveManifest(manifest);
  return manifest;
}

function markAppliedItems(queue, changes, report) {
  const changedByItem = new Map();
  for (const change of changes) {
    const itemIds = change.reviewQueueItemIds?.length
      ? change.reviewQueueItemIds
      : [change.reviewQueueItemId].filter(Boolean);
    for (const itemId of itemIds) {
      changedByItem.set(itemId, (changedByItem.get(itemId) || 0) + change.count);
    }
  }

  for (const item of queue.items || []) {
    const replacements = changedByItem.get(item.id) || 0;
    if (!replacements) continue;
    item.application = {
      appliedAt: report.timestamp,
      version: report.version,
      finalPath: relativeWorkflowPath(report.finalPath),
      replacements,
      action: item.status === 'rejected' ? 'kept_or_restored' : 'applied',
    };
  }
  refreshPdfEpubReviewQueueSummary(queue);
}

export async function applyApprovedPdfEpubFindings({
  sourcePath = null,
  manualReplacements = [],
} = {}) {
  ensureDirs();
  const queue = readJson(pdfEpubStatePath('reviewQueue'));
  if (!queue) throw new Error('Fila PDF x EPUB nao encontrada. Valide achados primeiro.');

  const target = sourcePath
    ? { filePath: sourcePath, filename: path.basename(sourcePath), source: 'explicit' }
    : resolveEpubTarget({ workflowRoot });
  if (!target.filePath) throw new Error('Nenhum EPUB alvo encontrado para aplicar achados aprovados.');
  const sourceEpub = readEpubFile(target.filePath);
  const entriesByChapter = chapterEntryMap(sourceEpub);
  const sourceZip = new AdmZip(target.filePath);
  const reconciled = reconcilePendingApprovedItems(
    queue,
    sourceZip,
    entriesByChapter,
    target.filePath
  );
  if (reconciled) writeJson(paths.reviewQueuePath, queue);
  const { replacements: approved, skipped } = approvedReplacements(
    queue,
    entriesByChapter
  );
  const replacements = [...approved, ...manualReplacements];

  const { version, numericVersion, dir } = nextVersionDir();
  const baseName = path.basename(target.filePath, path.extname(target.filePath)).replace(/_v\d+.*$/i, '');
  const outputName = `${baseName}_${version}_pdf_epub_fixed.epub`;
  const versionPath = path.join(dir, outputName);
  const finalPath = path.join(paths.outputDir, outputName);
  const zip = sourceZip;
  const changedEntries = [];
  const allChanges = [];
  const expectedEntries = new Map();

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !shouldEditEntry(entry.entryName)) continue;
    const html = entry.getData().toString('utf8');
    const result = updateXmlText(html, replacements, entry.entryName);
    if (!result.changes.length) continue;
    zip.updateFile(entry.entryName, Buffer.from(result.html, 'utf8'));
    expectedEntries.set(entry.entryName, result.html);
    allChanges.push(...result.changes.map((change) => ({ ...change, entry: entry.entryName })));
    changedEntries.push({
      entry: entry.entryName,
      corrections: result.changes.length,
      replacements: result.changes.reduce((sum, item) => sum + item.count, 0),
    });
  }

  const report = {
    schemaVersion: '1.0',
    timestamp: new Date().toISOString(),
    version,
    sourcePath: target.filePath,
    versionPath,
    finalPath,
    approvedItems: (queue.items || []).filter((item) => item.status === 'approved').length,
    plannedReplacements: replacements,
    skippedApprovedItems: skipped,
    changes: allChanges,
    changedEntries,
    totalReplacements: allChanges.reduce((sum, item) => sum + item.count, 0),
  };

  if (report.totalReplacements <= 0) {
    if (replacements.length && replacementsAlreadyApplied(zip, replacements)) {
      return {
        ...report,
        noOp: true,
        reason: 'approved_replacements_already_present',
        message: `Nenhuma substituicao pendente encontrada. ${replacements.length} substituicao(oes) aprovada(s) ja parecem estar aplicadas no EPUB alvo.`,
        finalPath: target.filePath,
        version: null,
      };
    }
    if (replacements.length) {
      throw new Error(`${replacements.length} correcao(oes) aprovada(s) nao puderam ser localizadas no EPUB alvo.`);
    }
    const alreadyApplied = skipped.filter((item) => item.reason === 'approved_item_already_applied').length;
    return {
      ...report,
      noOp: true,
      reason: alreadyApplied ? 'approved_items_already_applied' : 'nothing_to_apply',
      message: alreadyApplied
        ? `Nenhum achado aprovado pendente de aplicacao. ${alreadyApplied} achado(s) ja foram aplicados anteriormente.`
        : 'Nenhuma substituicao ou limpeza de titulo pendente foi encontrada no EPUB alvo.',
      alreadyApplied,
      finalPath: target.filePath,
      version: null,
    };
  }

  const candidatePath = `${versionPath}.tmp`;
  await writeEpubZip(zip, candidatePath);
  report.validation = validateGeneratedEpub(candidatePath, allChanges, expectedEntries);
  if (!report.validation.valid) {
    fs.rmSync(candidatePath, { force: true });
    throw new Error(`EPUB gerado falhou na validacao: ${report.validation.unresolvedScopedChanges.length} correcao(oes) por ocorrencia nao foram confirmadas.`);
  }
  fs.renameSync(candidatePath, versionPath);
  fs.copyFileSync(versionPath, finalPath);
  report.manifest = updateManifest({ version, numericVersion, sourcePath: target.filePath, versionPath, finalPath, report });
  markAppliedItems(queue, allChanges, report);
  writeJson(paths.reviewQueuePath, queue);
  writeJson(paths.applicationReportPath, {
    ...report,
    sourcePath: relativeWorkflowPath(report.sourcePath),
    versionPath: relativeWorkflowPath(report.versionPath),
    finalPath: relativeWorkflowPath(report.finalPath),
  });

  appendWorkflowEvent('PDF_EPUB_APPROVED_FINDINGS_APPLIED', {
    version,
    source: relativeWorkflowPath(target.filePath),
    finalPath: relativeWorkflowPath(finalPath),
    replacements: report.totalReplacements,
    approvedItems: report.approvedItems,
  });

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyApprovedPdfEpubFindings()
    .then(async (report) => {
      const { runPdfEpubComparisonReport } = await import('./auditPdfEpubReport.js');
      const reportPath = await runPdfEpubComparisonReport();
      console.log(report.noOp ? report.message : relativeWorkflowPath(report.finalPath));
      console.log(`Relatorio atualizado: ${relativeWorkflowPath(reportPath)}`);
    })
    .catch((error) => {
      console.error(`Erro ao aplicar achados PDF x EPUB: ${error.message}`);
      process.exit(1);
    });
}
