#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
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
  return { from, to };
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

function approvedReplacements(queue) {
  const replacements = [];
  const skipped = [];
  const seen = new Set();

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
    const key = `${replacement.from}\u0000${replacement.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    replacements.push({ ...replacement, reviewQueueItemId: item.id });
  }

  return { replacements, skipped };
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

function replacementAlreadyPresent(zip, replacement) {
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

function updateXmlText(html, replacements) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const changes = [];

  $('script, style').remove();
  $.root().find('*').addBack().contents().each((_, node) => {
    if (node.type !== 'text') return;
    if (!node.data || !node.data.trim()) return;

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

    for (const replacement of replacements) {
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
  });

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
    if (!change.reviewQueueItemId) continue;
    changedByItem.set(change.reviewQueueItemId, (changedByItem.get(change.reviewQueueItemId) || 0) + change.count);
  }

  for (const item of queue.items || []) {
    if (item.status !== 'approved') continue;
    const replacements = changedByItem.get(item.id) || 0;
    if (!replacements) continue;
    item.application = {
      appliedAt: report.timestamp,
      version: report.version,
      finalPath: relativeWorkflowPath(report.finalPath),
      replacements,
    };
  }
  refreshPdfEpubReviewQueueSummary(queue);
}

export async function applyApprovedPdfEpubFindings({ sourcePath = null } = {}) {
  ensureDirs();
  const queue = readJson(pdfEpubStatePath('reviewQueue'));
  if (!queue) throw new Error('Fila PDF x EPUB nao encontrada. Valide achados primeiro.');

  const { replacements, skipped } = approvedReplacements(queue);

  const target = sourcePath
    ? { filePath: sourcePath, filename: path.basename(sourcePath), source: 'explicit' }
    : resolveEpubTarget({ workflowRoot });
  if (!target.filePath) throw new Error('Nenhum EPUB alvo encontrado para aplicar achados aprovados.');

  const { version, numericVersion, dir } = nextVersionDir();
  const baseName = path.basename(target.filePath, path.extname(target.filePath)).replace(/_v\d+.*$/i, '');
  const outputName = `${baseName}_${version}_pdf_epub_fixed.epub`;
  const versionPath = path.join(dir, outputName);
  const finalPath = path.join(paths.outputDir, outputName);
  const zip = new AdmZip(target.filePath);
  const changedEntries = [];
  const allChanges = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !shouldEditEntry(entry.entryName)) continue;
    const html = entry.getData().toString('utf8');
    const result = updateXmlText(html, replacements);
    if (!result.changes.length) continue;
    zip.updateFile(entry.entryName, Buffer.from(result.html, 'utf8'));
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

  await writeEpubZip(zip, versionPath);
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
    .then((report) => {
      console.log(report.noOp ? report.message : relativeWorkflowPath(report.finalPath));
    })
    .catch((error) => {
      console.error(`Erro ao aplicar achados PDF x EPUB: ${error.message}`);
      process.exit(1);
    });
}
