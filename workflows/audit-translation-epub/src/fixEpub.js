#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
import { readFirstEpubFromDir } from './epubReader.js';
import { readFirstTxtFromDir, readTranslationLog } from './logReader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');

const paths = {
  translatedDir: path.join(workflowRoot, 'input/translated'),
  logsInputDir: path.join(workflowRoot, 'input/logs'),
  inputFixedDir: path.join(workflowRoot, 'input-fixed'),
  outputDir: path.join(workflowRoot, 'output'),
  logsDir: path.join(workflowRoot, 'logs'),
  workflowEventsPath: path.join(workflowRoot, 'logs/workflow-events.jsonl'),
  manifestPath: path.join(workflowRoot, 'input-fixed/manifest.json'),
};

function parseArgs(argv) {
  const args = { translated: null, log: null };

  for (const arg of argv) {
    if (arg.startsWith('--translated=')) args.translated = path.resolve(arg.slice('--translated='.length));
    else if (arg.startsWith('--log=')) args.log = path.resolve(arg.slice('--log='.length));
  }

  return args;
}

function ensureDirs() {
  const dirs = [
    paths.translatedDir,
    paths.logsInputDir,
    paths.inputFixedDir,
    paths.outputDir,
    paths.logsDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function relativeWorkflowPath(filePath) {
  if (!filePath) return null;
  const relative = path.relative(workflowRoot, filePath).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : filePath;
}

function appendWorkflowEvent(event, payload = {}) {
  if (fs.existsSync(paths.workflowEventsPath) && fs.statSync(paths.workflowEventsPath).isDirectory()) {
    fs.rmSync(paths.workflowEventsPath, { recursive: true, force: true });
  }

  const entry = {
    time: new Date().toISOString(),
    event,
    ...payload,
  };
  fs.appendFileSync(paths.workflowEventsPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function loadManifest() {
  if (!fs.existsSync(paths.manifestPath)) {
    return {
      currentVersion: 0,
      currentPath: 'output',
      origin: 'input/translated',
      versions: [],
      finalOutput: 'output',
    };
  }

  try {
    return JSON.parse(fs.readFileSync(paths.manifestPath, 'utf8'));
  } catch {
    return {
      currentVersion: 0,
      currentPath: 'output',
      origin: 'input/translated',
      versions: [],
      finalOutput: 'output',
    };
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function updateManifest({ version, translated, versionPath, finalPath, report }) {
  const manifest = loadManifest();
  const numericVersion = Number(String(version).replace(/^v/i, ''));
  manifest.currentVersion = numericVersion;
  manifest.currentPath = 'output';
  manifest.origin = 'input/translated';
  manifest.finalOutput = 'output';
  manifest.versions = [
    ...(manifest.versions || []).filter((item) => item.version !== numericVersion),
    {
      version: numericVersion,
      source: relativeWorkflowPath(translated.filePath),
      output: relativeWorkflowPath(path.dirname(versionPath)),
      file: path.basename(versionPath),
      finalFile: path.basename(finalPath),
      createdAt: report.timestamp,
      step: numericVersion,
      metadata: {
        replacementsApplied: report.totalReplacements,
        changedEntries: report.changedEntries.length,
        packageValidation: report.packageValidation,
      },
    },
  ].sort((a, b) => a.version - b.version);
  saveManifest(manifest);
  return manifest;
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
  return { version: `v${next}`, dir };
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacementRegex(from) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedRegex(from)})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
}

function applyReplacementToText(text, replacement) {
  const regex = replacementRegex(replacement.from);
  let count = 0;
  const nextText = String(text).replace(regex, (match, prefix) => {
    count += 1;
    return `${prefix}${replacement.to}`;
  });

  return { text: nextText, count };
}

function shouldEditEntry(entryName) {
  return /\.(xhtml|html|htm)$/i.test(entryName);
}

function updateHtmlText(html, replacements) {
  const $ = cheerio.load(html, {
    xmlMode: true,
    decodeEntities: false,
  });
  const changes = [];

  $('script, style').remove();

  $('body *').contents().each((_, node) => {
    if (node.type !== 'text') return;
    if (!node.data || !node.data.trim()) return;

    let text = node.data;
    for (const replacement of replacements) {
      const result = applyReplacementToText(text, replacement);
      if (result.count > 0) {
        changes.push({
          from: replacement.from,
          to: replacement.to,
          count: result.count,
        });
        text = result.text;
      }
    }

    node.data = text;
  });

  return {
    html: $.xml(),
    changes,
  };
}

function mergeChanges(changes) {
  const merged = new Map();

  for (const change of changes) {
    const key = `${change.from}\u0000${change.to}`;
    const current = merged.get(key) || { from: change.from, to: change.to, count: 0 };
    current.count += change.count;
    merged.set(key, current);
  }

  return [...merged.values()];
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

function validateEpubPackage(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const firstEntry = entries[0]?.entryName || null;
  const mimetype = zip.getEntry('mimetype')?.getData().toString('utf8') || '';
  const hasContainer = Boolean(zip.getEntry('META-INF/container.xml'));

  return {
    mimetypeFirst: firstEntry === 'mimetype',
    mimetypeValid: mimetype.trim() === 'application/epub+zip',
    hasContainer,
  };
}

export async function fixEpub({ translatedPath, logPath } = {}) {
  ensureDirs();

  const translated = translatedPath
    ? { filePath: translatedPath, filename: path.basename(translatedPath) }
    : readFirstEpubFromDir(paths.translatedDir);
  if (!translated) throw new Error(`Nenhum EPUB traduzido encontrado em ${paths.translatedDir}`);

  const logInfo = readTranslationLog(logPath || readFirstTxtFromDir(paths.logsInputDir));
  const replacements = (logInfo.replacements || []).filter((item) => item.from && item.to);

  const { version, dir } = nextVersionDir();
  const baseName = path.basename(translated.filePath, path.extname(translated.filePath));
  const outputName = `${baseName}_${version}_fixed.epub`;
  const versionPath = path.join(dir, outputName);
  const finalPath = path.join(paths.outputDir, outputName);
  const zip = new AdmZip(translated.filePath);
  const changedEntries = [];

  if (replacements.length > 0) {
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !shouldEditEntry(entry.entryName)) continue;

      const originalHtml = entry.getData().toString('utf8');
      const result = updateHtmlText(originalHtml, replacements);
      if (result.changes.length === 0) continue;

      zip.updateFile(entry.entryName, Buffer.from(result.html, 'utf8'));
      changedEntries.push({
        entry: entry.entryName,
        changes: mergeChanges(result.changes),
      });
    }
  }

  await writeEpubZip(zip, versionPath);
  fs.copyFileSync(versionPath, finalPath);

  const report = {
    timestamp: new Date().toISOString(),
    version,
    source: translated.filePath,
    versionPath,
    finalPath,
    logFile: logInfo.filePath,
    replacements,
    changedEntries,
    packageValidation: validateEpubPackage(versionPath),
    totalReplacements: changedEntries.reduce(
      (sum, entry) => sum + entry.changes.reduce((inner, change) => inner + change.count, 0),
      0
    ),
  };
  report.manifest = updateManifest({ version, translated, versionPath, finalPath, report });

  appendWorkflowEvent('VERSION_CREATED', {
    version,
    source: relativeWorkflowPath(translated.filePath),
    output: relativeWorkflowPath(dir),
  });
  appendWorkflowEvent('VERSION_FILE_PUBLISHED', {
    file: path.basename(finalPath),
    source: relativeWorkflowPath(versionPath),
    destination: relativeWorkflowPath(finalPath),
    version,
    replacementsApplied: report.totalReplacements,
  });

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await fixEpub({
    translatedPath: args.translated,
    logPath: args.log,
  });

  console.log('=== EPUB REVISADO GERADO ===');
  console.log(`Versao: ${report.version}`);
  console.log(`Substituicoes aplicadas: ${report.totalReplacements}`);
  console.log(`Arquivo versionado: ${report.versionPath}`);
  console.log(`Arquivo final: ${report.finalPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Erro fatal: ${error.message}`);
    process.exit(1);
  });
}
