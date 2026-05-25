#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
import { readFirstEpubFromDir } from './epubReader.js';
import { buildApprovedCorrectionActions } from './correction/approvedCorrectionsReader.js';
import { applySafeCorrectionsToZip } from './correction/xhtmlCorrectionEngine.js';
import { validatePostCorrection } from './correction/postCorrectionValidator.js';
import {
  formatReviewQueueValidation,
  validateReviewQueue,
} from './correction/reviewQueueValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(workflowRoot, '../..');

const paths = {
  translatedDir: path.join(workflowRoot, 'input/translated'),
  logsInputDir: path.join(workflowRoot, 'input/logs'),
  inputFixedDir: path.join(workflowRoot, 'input-fixed'),
  outputDir: path.join(workflowRoot, 'output'),
  logsDir: path.join(workflowRoot, 'logs'),
  logsJsonDir: path.join(workflowRoot, 'logs/json'),
  workflowEventsPath: path.join(workflowRoot, 'logs/workflow-events.jsonl'),
  manifestPath: path.join(workflowRoot, 'input-fixed/manifest.json'),
  correctionPlanPath: path.join(workflowRoot, 'logs/json/correction-plan.json'),
  correctionReportPath: path.join(workflowRoot, 'logs/json/correction-report.json'),
  postCorrectionValidationPath: path.join(workflowRoot, 'logs/json/post-correction-validation.json'),
  reauditReportPath: path.join(workflowRoot, 'logs/json/reaudit-report.json'),
  reauditoriaSummaryPath: path.join(workflowRoot, 'logs/json/reauditoria-summary.json'),
  reviewQueuePath: path.join(workflowRoot, 'logs/json/review-queue.json'),
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
    paths.logsJsonDir,
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
        postCorrectionValidation: {
          status: report.postCorrectionValidation?.status,
          textChanged: report.postCorrectionValidation?.textComparison?.textChanged,
          confirmedCorrections: report.postCorrectionValidation?.correctionValidation?.confirmedCorrections,
        },
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

function loadCorrectionPlan() {
  if (!fs.existsSync(paths.correctionPlanPath)) {
    return {
      schemaVersion: '1.0',
      workflow: 'audit-translation-epub',
      createdAt: new Date().toISOString(),
      source: {},
      summary: {
        totalCandidates: 0,
        autoSafe: 0,
        autoReview: 0,
        manualOnly: 0,
      },
      actions: [],
      warning: 'correction-plan.json nao encontrado; rode a auditoria antes da correcao.',
    };
  }

  return JSON.parse(fs.readFileSync(paths.correctionPlanPath, 'utf8'));
}

function loadReviewQueue() {
  if (!fs.existsSync(paths.reviewQueuePath)) return null;
  return JSON.parse(fs.readFileSync(paths.reviewQueuePath, 'utf8'));
}

function buildApplicationPlan(correctionPlan, reviewQueue) {
  if (reviewQueue) {
    const reviewValidation = validateReviewQueue(reviewQueue);
    if (!reviewValidation.ok) {
      throw new Error(`Review queue invalida:\n${formatReviewQueueValidation(reviewValidation)}`);
    }
  }

  const approvedCorrections = buildApprovedCorrectionActions(reviewQueue);
  return {
    applicationPlan: {
      ...correctionPlan,
      actions: [
        ...(correctionPlan.actions || []),
        ...approvedCorrections.actions,
      ],
      reviewQueueApproved: approvedCorrections.summary,
    },
    approvedCorrections,
  };
}

function attachReviewQueueResult(correctionResult, approvedCorrections) {
  const reviewSkipped = approvedCorrections.skippedItems.map((item) => ({
    actionId: item.actionId,
    candidateId: item.candidateId,
    reviewQueueItemId: item.reviewQueueItemId,
    type: item.type,
    mode: item.mode,
    source: item.source,
    status: item.status,
    reason: item.reason,
    filePath: item.filePath,
    nodeId: item.nodeId,
    confidence: item.confidence,
  }));

  correctionResult.skippedActions.push(...reviewSkipped);
  correctionResult.reviewQueueApproved = approvedCorrections.summary;
  correctionResult.summary.skippedActions = correctionResult.skippedActions.length;
  correctionResult.summary.reviewQueueApprovedActions = approvedCorrections.summary.approvedApplicable;
  correctionResult.summary.reviewQueueIgnoredItems = approvedCorrections.summary.ignored;
  return correctionResult;
}

function latestAuditReportPath() {
  if (!fs.existsSync(paths.logsJsonDir)) return null;
  const reports = fs.readdirSync(paths.logsJsonDir)
    .filter((file) => /^audit-report-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}\.json$/i.test(file))
    .map((file) => path.join(paths.logsJsonDir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return reports[0] || null;
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runAuditForCorrected(finalPath) {
  const result = spawnSync(process.execPath, [
    'workflows/audit-translation-epub/src/audit.js',
    `--translated=${finalPath}`,
  ], {
    cwd: projectRoot,
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Reauditoria falhou: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function classifyReaudit(beforeReport, afterReport) {
  if (!beforeReport || !afterReport) return 'unknown';

  const beforeIssues = beforeReport.stats?.totalIssues ?? beforeReport.issues?.length ?? 0;
  const afterIssues = afterReport.stats?.totalIssues ?? afterReport.issues?.length ?? 0;
  const beforeWarnings = beforeReport.stats?.totalWarnings ?? beforeReport.warnings?.length ?? 0;
  const afterWarnings = afterReport.stats?.totalWarnings ?? afterReport.warnings?.length ?? 0;
  const beforeCandidates = beforeReport.correctionCandidates?.length ?? 0;
  const afterCandidates = afterReport.correctionCandidates?.length ?? 0;

  if (
    afterIssues < beforeIssues ||
    (afterIssues === beforeIssues && afterWarnings < beforeWarnings) ||
    (afterIssues === beforeIssues && afterWarnings === beforeWarnings && afterCandidates < beforeCandidates)
  ) {
    return 'improvement';
  }

  if (
    afterIssues > beforeIssues ||
    (afterIssues === beforeIssues && afterWarnings > beforeWarnings) ||
    (afterIssues === beforeIssues && afterWarnings === beforeWarnings && afterCandidates > beforeCandidates)
  ) {
    return 'regression';
  }

  return 'neutral';
}

function buildReauditoriaSummary({ beforeReport, afterReport, correctionResult, postCorrectionValidation }) {
  return {
    schemaVersion: '1.0',
    timestamp: new Date().toISOString(),
    issuesBefore: beforeReport?.stats?.totalIssues ?? beforeReport?.issues?.length ?? null,
    issuesAfter: afterReport?.stats?.totalIssues ?? afterReport?.issues?.length ?? null,
    warningsBefore: beforeReport?.stats?.totalWarnings ?? beforeReport?.warnings?.length ?? null,
    warningsAfter: afterReport?.stats?.totalWarnings ?? afterReport?.warnings?.length ?? null,
    correctionCandidatesBefore: beforeReport?.correctionCandidates?.length ?? null,
    correctionCandidatesAfter: afterReport?.correctionCandidates?.length ?? null,
    appliedCorrections: correctionResult.summary.appliedCorrections,
    validationStatus: postCorrectionValidation.status,
    result: classifyReaudit(beforeReport, afterReport),
  };
}

function runPostFixReaudit({ finalPath, beforeReport, correctionResult, postCorrectionValidation }) {
  const auditRun = runAuditForCorrected(finalPath);
  const afterPath = latestAuditReportPath();
  const afterReport = readJsonFile(afterPath);

  if (afterReport) {
    fs.writeFileSync(paths.reauditReportPath, `${JSON.stringify(afterReport, null, 2)}\n`, 'utf8');
  }

  const summary = buildReauditoriaSummary({
    beforeReport,
    afterReport,
    correctionResult,
    postCorrectionValidation,
  });
  fs.writeFileSync(paths.reauditoriaSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return {
    auditRun,
    reauditReportPath: paths.reauditReportPath,
    reauditoriaSummaryPath: paths.reauditoriaSummaryPath,
    summary,
  };
}

export async function fixEpub({ translatedPath, logPath } = {}) {
  ensureDirs();

  const translated = translatedPath
    ? { filePath: translatedPath, filename: path.basename(translatedPath) }
    : readFirstEpubFromDir(paths.translatedDir);
  if (!translated) throw new Error(`Nenhum EPUB traduzido encontrado em ${paths.translatedDir}`);

  const beforeReport = readJsonFile(latestAuditReportPath());
  const { version, dir } = nextVersionDir();
  const baseName = path.basename(translated.filePath, path.extname(translated.filePath));
  const outputName = `${baseName}_${version}_fixed.epub`;
  const versionPath = path.join(dir, outputName);
  const finalPath = path.join(paths.outputDir, outputName);
  const zip = new AdmZip(translated.filePath);
  const correctionPlan = loadCorrectionPlan();
  const reviewQueue = loadReviewQueue();
  const { applicationPlan, approvedCorrections } = buildApplicationPlan(correctionPlan, reviewQueue);
  const correctionResult = attachReviewQueueResult(
    applySafeCorrectionsToZip(zip, applicationPlan),
    approvedCorrections
  );

  await writeEpubZip(zip, versionPath);
  fs.copyFileSync(versionPath, finalPath);
  const postCorrectionValidation = validatePostCorrection({
    translatedPath: translated.filePath,
    correctedPath: finalPath,
    correctionResult,
    correctionReportPath: paths.correctionReportPath,
    outputPath: paths.postCorrectionValidationPath,
  });

  const report = {
    timestamp: new Date().toISOString(),
    version,
    source: translated.filePath,
    versionPath,
    finalPath,
    correctionPlanPath: paths.correctionPlanPath,
    reviewQueuePath: paths.reviewQueuePath,
    correctionReportPath: paths.correctionReportPath,
    postCorrectionValidationPath: paths.postCorrectionValidationPath,
    changedEntries: correctionResult.changedEntries,
    appliedCorrections: correctionResult.appliedCorrections,
    skippedActions: correctionResult.skippedActions,
    packageValidation: validateEpubPackage(versionPath),
    postCorrectionValidation,
    totalReplacements: correctionResult.summary.replacements,
    reviewQueueApproved: correctionResult.reviewQueueApproved,
  };
  report.manifest = updateManifest({ version, translated, versionPath, finalPath, report });
  fs.writeFileSync(paths.correctionReportPath, `${JSON.stringify({
    ...correctionResult,
    timestamp: report.timestamp,
    version,
    source: relativeWorkflowPath(translated.filePath),
    versionPath: relativeWorkflowPath(versionPath),
    finalPath: relativeWorkflowPath(finalPath),
    correctionPlanPath: relativeWorkflowPath(paths.correctionPlanPath),
    reviewQueuePath: relativeWorkflowPath(paths.reviewQueuePath),
    reviewQueueApproved: correctionResult.reviewQueueApproved,
  }, null, 2)}\n`, 'utf8');
  const reauditoria = runPostFixReaudit({
    finalPath,
    beforeReport,
    correctionResult,
    postCorrectionValidation,
  });
  report.reauditoria = reauditoria.summary;

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
    appliedCorrections: correctionResult.summary.appliedCorrections,
    skippedActions: correctionResult.summary.skippedActions,
    reviewQueueApprovedApplied: correctionResult.reviewQueueApproved.approvedApplicable,
    reviewQueueIgnoredItems: correctionResult.reviewQueueApproved.ignored,
    postCorrectionStatus: postCorrectionValidation.status,
    textChanged: postCorrectionValidation.textComparison.textChanged,
    confirmedCorrections: postCorrectionValidation.correctionValidation.confirmedCorrections,
    reauditoriaResult: reauditoria.summary.result,
    issuesBefore: reauditoria.summary.issuesBefore,
    issuesAfter: reauditoria.summary.issuesAfter,
    warningsBefore: reauditoria.summary.warningsBefore,
    warningsAfter: reauditoria.summary.warningsAfter,
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
