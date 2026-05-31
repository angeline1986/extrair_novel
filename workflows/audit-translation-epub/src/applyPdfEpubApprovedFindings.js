#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
import { resolveEpubTarget } from './epubTargetResolver.js';
import { refreshPdfEpubReviewQueueSummary } from './pdfEpubReviewQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');

const paths = {
  inputFixedDir: path.join(workflowRoot, 'input-fixed'),
  outputDir: path.join(workflowRoot, 'output'),
  stateDir: path.join(workflowRoot, 'state'),
  manifestPath: path.join(workflowRoot, 'input-fixed/manifest.json'),
  reviewQueuePath: path.join(workflowRoot, 'state/pdf-epub-review-queue.json'),
  applicationReportPath: path.join(workflowRoot, 'state/pdf-epub-application-report.json'),
  workflowEventsPath: path.join(workflowRoot, 'logs/workflow-events.jsonl'),
};

function ensureDirs() {
  for (const dir of [paths.inputFixedDir, paths.outputDir, paths.stateDir, path.dirname(paths.workflowEventsPath)]) {
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
  return readJson(paths.manifestPath, {
    currentVersion: 0,
    currentPath: 'output',
    origin: 'input/translated',
    versions: [],
    finalOutput: 'output',
  });
}

function saveManifest(manifest) {
  writeJson(paths.manifestPath, manifest);
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

function stripChapterPrefix(value) {
  return String(value || '').replace(/^\s*\d+[.)]?\s*/, '').trim();
}

function titleReplacement(item) {
  const recommended = quotedRecommendation(item.recommendation) || item.recommendation;
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

function termReplacement(item) {
  const from = item.problematicTerm || item.sourceTerm || item.original;
  const to = quotedRecommendation(item.recommendation) || item.recommendation;
  if (!from || !to) return null;
  if (String(from).trim() === String(to).trim()) return null;
  if (String(to).length > 80) return null;
  return { from: String(from).trim(), to: String(to).trim() };
}

function replacementFromItem(item) {
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

function updateXmlText(html, replacements) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  const changes = [];

  $('script, style').remove();
  $.root().find('*').addBack().contents().each((_, node) => {
    if (node.type !== 'text') return;
    if (!node.data || !node.data.trim()) return;

    let text = node.data;
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
  const queue = readJson(paths.reviewQueuePath);
  if (!queue) throw new Error('Fila PDF x EPUB nao encontrada. Valide achados primeiro.');

  const { replacements, skipped } = approvedReplacements(queue);
  if (!replacements.length) {
    const alreadyApplied = skipped.filter((item) => item.reason === 'approved_item_already_applied').length;
    if (alreadyApplied > 0) {
      return {
        schemaVersion: '1.0',
        timestamp: new Date().toISOString(),
        noOp: true,
        reason: 'approved_items_already_applied',
        message: `Nenhum achado aprovado pendente de aplicacao. ${alreadyApplied} achado(s) ja foram aplicados anteriormente.`,
        alreadyApplied,
        totalReplacements: 0,
        changedEntries: [],
        skippedApprovedItems: skipped,
      };
    }
    throw new Error('Nenhum achado PDF x EPUB aprovado possui substituicao clara para aplicar.');
  }

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
    throw new Error('Nenhuma substituicao aprovada foi encontrada no EPUB alvo.');
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
