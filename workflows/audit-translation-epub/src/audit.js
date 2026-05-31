#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEpubFile, readFirstEpubFromDir } from './epubReader.js';
import { readFirstTxtFromDir, readTranslationLog, auditLogAgainstTranslation } from './logReader.js';
import {
  runEpubContentChecks,
  runEpubLanguageChecks,
  runEpubStructuralChecks,
} from './checks.js';
import {
  buildEpubVersionWorkflow,
  buildEpubWorkflowTrace,
  loadEpubManifest,
  writeEpubHtmlDashboard,
} from './epubDashboardWriter.js';
import { writeEpubValidationTabsDashboard } from './epubValidationWriter.js';
import { writeEpubReaderReport } from './epubReaderReportWriter.js';
import {
  buildCorrectionCandidates,
  buildCorrectionPlan,
  loadCorrectionGlossary,
} from './correction/correctionPlanner.js';
import {
  buildReviewQueue,
  renderReviewQueueMarkdown,
} from './correction/reviewQueue.js';
import {
  buildAssistedReviewSuggestions,
  renderAssistedReviewMarkdown,
} from './correction/assistedReview.js';
import { createOllamaAdapter } from './correction/ollamaAdapter.js';
import { buildXhtmlMap } from './xhtmlMapper.js';
import { buildChapterAlignment } from './chapterAligner.js';
import { buildSemanticConsistencyAudit } from './semanticConsistencyAudit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');

const paths = {
  sourceDir: path.join(workflowRoot, 'input/source'),
  translatedDir: path.join(workflowRoot, 'input/translated'),
  translationLogInputDir: path.join(workflowRoot, 'input/translation-log'),
  glossaryDir: path.join(workflowRoot, 'input/glossary'),
  termsGlossaryPath: path.join(workflowRoot, 'input/glossary/terms.json'),
  entitiesGlossaryPath: path.join(workflowRoot, 'input/glossary/entities.json'),
  logsDir: path.join(workflowRoot, 'logs'),
  reportsDir: path.join(workflowRoot, 'reports'),
  reportsTxtDir: path.join(workflowRoot, 'reports/txt'),
  reportsJsonDir: path.join(workflowRoot, 'reports/json'),
  reportsHtmlDir: path.join(workflowRoot, 'reports/html'),
  stateDir: path.join(workflowRoot, 'state'),
  outputDir: path.join(workflowRoot, 'output'),
  workflowEventsPath: path.join(workflowRoot, 'logs/workflow-events.jsonl'),
  assistedReviewModelTracePath: path.join(workflowRoot, 'logs/assisted-review-model-trace.json'),
};

function parseArgs(argv) {
  const args = { source: null, translated: null, log: null, sourceLanguage: 'en', verbose: false };

  for (const arg of argv) {
    if (arg === '--verbose') args.verbose = true;
    else if (arg.startsWith('--source=')) args.source = path.resolve(arg.slice('--source='.length));
    else if (arg.startsWith('--translated=')) args.translated = path.resolve(arg.slice('--translated='.length));
    else if (arg.startsWith('--log=')) args.log = path.resolve(arg.slice('--log='.length));
    else if (arg.startsWith('--source-language=')) args.sourceLanguage = arg.slice('--source-language='.length);
  }

  return args;
}

function ensureDirs() {
  const dirs = [
    paths.sourceDir,
    paths.translatedDir,
    paths.translationLogInputDir,
    paths.glossaryDir,
    paths.logsDir,
    paths.reportsDir,
    paths.reportsTxtDir,
    paths.reportsJsonDir,
    paths.reportsHtmlDir,
    paths.stateDir,
    paths.outputDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function alignSections(sourceDoc, translationDoc) {
  const aligned = [];
  const sourceSections = sourceDoc.sections.filter((section) => section.charCount > 0);
  const translationSections = translationDoc.sections.filter((section) => section.charCount > 0);
  const max = Math.max(sourceSections.length, translationSections.length);

  for (let index = 0; index < max; index++) {
    const source = sourceSections[index];
    const translation = translationSections[index];

    if (source && translation) {
      const ratio = translation.charCount / Math.max(source.charCount, 1);
      aligned.push({
        sourceIndex: source.index,
        sourceTitle: source.title,
        sourceParagraphs: source.paragraphCount,
        sourceCharCount: source.charCount,
        translationIndex: translation.index,
        translationTitle: translation.title,
        translationParagraphs: translation.paragraphCount,
        translationCharCount: translation.charCount,
        matchType: 'matched',
        confidence: Math.max(0.1, Math.min(1, Math.min(ratio, 1 / Math.max(ratio, 0.01)))),
      });
    } else if (source) {
      aligned.push({
        sourceIndex: source.index,
        sourceTitle: source.title,
        sourceParagraphs: source.paragraphCount,
        sourceCharCount: source.charCount,
        matchType: 'missing',
        confidence: 0,
      });
    } else if (translation) {
      aligned.push({
        translationIndex: translation.index,
        translationTitle: translation.title,
        translationParagraphs: translation.paragraphCount,
        translationCharCount: translation.charCount,
        matchType: 'extra',
        confidence: 0,
      });
    }
  }

  return aligned;
}

function statusFromIssues(issues, warnings) {
  if (issues.some((issue) => issue.severity === 'FAIL')) return 'FAIL';
  if (issues.length || warnings.length) return 'WARN';
  return 'OK';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDetails(item) {
  if (item.description) return item.description;
  if (item.details) return JSON.stringify(item.details);
  return '-';
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'fail') return 'fail';
  if (normalized === 'warn' || normalized === 'warning') return 'warn';
  if (normalized === 'info') return 'info';
  return 'ok';
}

function statusBadge(status, label = status) {
  const kind = statusClass(status);
  return `<span class="status ${kind}">${escapeHtml(label || status || 'OK')}</span>`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatTimestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
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

function pruneOldAuditReports(keepPath) {
  if (!fs.existsSync(paths.reportsJsonDir)) return;

  for (const file of fs.readdirSync(paths.reportsJsonDir)) {
    if (!/^audit-report-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}\.json$/i.test(file)) continue;

    const filePath = path.join(paths.reportsJsonDir, file);
    if (filePath !== keepPath) fs.unlinkSync(filePath);
  }
}

function serializeFinding(item) {
  return {
    type: item.type,
    severity: item.severity,
    description: item.description || item.type,
    details: item.details || null,
    occurrences: item.occurrences || item.count || null,
    examples: item.examples || null,
  };
}

function generateSummary(alignedDoc, issues, warnings) {
  const missingSections = [];
  const sizeIssues = [];

  for (const section of alignedDoc.chapters || []) {
    if (section.matchType === 'missing') {
      missingSections.push({
        file: alignedDoc.source?.filename || 'unknown',
        index: section.sourceIndex,
        title: section.sourceTitle,
      });
    }

    if (section.matchType === 'matched') {
      const ratio = section.translationCharCount / Math.max(section.sourceCharCount, 1);
      if (ratio < 0.5) {
        sizeIssues.push({
          file: alignedDoc.source?.filename || 'unknown',
          section: section.sourceTitle || `Seção ${section.sourceIndex + 1}`,
          ratio: ratio.toFixed(2),
        });
      }
    }
  }

  return {
    missingChapters: missingSections.length,
    sizeIssues: sizeIssues.length,
    totalIssues: issues.length,
    totalWarnings: warnings.length,
    ollamaIssues: 0,
    firstMissingChapters: missingSections.slice(0, 5),
    firstSizeIssues: sizeIssues.slice(0, 5),
    epubSpecific: {
      missingSections: missingSections.length,
      sizeIssues: sizeIssues.length,
    },
  };
}

function serializeFile(alignedDoc) {
  return {
    filename: alignedDoc.source.filename,
    translationFilename: alignedDoc.translation.filename,
    alignment: alignedDoc.alignment,
    severity: alignedDoc.severity || null,
    sourceChars: alignedDoc.source.charCount,
    sourceParagraphs: alignedDoc.source.paragraphCount,
    translationChars: alignedDoc.translation.charCount,
    translationParagraphs: alignedDoc.translation.paragraphCount,
    chapterCount: alignedDoc.stats.sourceChapters,
    matchedChapters: alignedDoc.stats.matchedChapters,
    chapterIssues: alignedDoc.chapters.filter((chapter) => chapter.matchType !== 'matched').length,
    epub: {
      sourceSections: alignedDoc.source.sections.length,
      translationSections: alignedDoc.translation.sections.length,
      sectionCountDiff: alignedDoc.stats.chapterCountDiff,
      sections: alignedDoc.chapters,
    },
  };
}

function relativeWorkflowPath(filePath) {
  if (!filePath) return '-';
  const relative = path.relative(workflowRoot, filePath).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : filePath;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCorrectionMarkdownReport(outputPath) {
  const correctionReport = readJsonIfExists(path.join(paths.stateDir, 'correction-report.json'));
  const postValidation = readJsonIfExists(path.join(paths.stateDir, 'post-correction-validation.json'));
  const reauditoriaSummary = readJsonIfExists(path.join(paths.stateDir, 'reauditoria-summary.json'));
  const applied = correctionReport?.appliedCorrections || [];
  const skipped = correctionReport?.skippedActions || [];
  const correctionValidation = postValidation?.correctionValidation || {};
  const textComparison = postValidation?.textComparison || {};

  const lines = [
    '# Relatorio de Correcoes EPUB',
    '',
    `Status final: ${reauditoriaSummary?.result || 'unknown'}`,
    `Validacao pos-correcao: ${postValidation?.status || 'unknown'}`,
    `Correcoes aplicadas: ${applied.length}`,
    `Acoes ignoradas: ${skipped.length}`,
    `Mudanca textual real: ${textComparison.textChanged ? 'sim' : 'nao'}`,
    `Correcoes confirmadas: ${correctionValidation.confirmedCorrections || 0}/${correctionValidation.appliedCorrections || 0}`,
    '',
    '## Reauditoria',
    '',
    `- Issues: ${reauditoriaSummary?.issuesBefore ?? '-'} -> ${reauditoriaSummary?.issuesAfter ?? '-'}`,
    `- Warnings: ${reauditoriaSummary?.warningsBefore ?? '-'} -> ${reauditoriaSummary?.warningsAfter ?? '-'}`,
    `- Correction candidates: ${reauditoriaSummary?.correctionCandidatesBefore ?? '-'} -> ${reauditoriaSummary?.correctionCandidatesAfter ?? '-'}`,
    '',
    '## Correcoes Aplicadas',
    '',
    '| Tipo | Origem | Before | After | Arquivo | Node | Confidence |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...(applied.length
      ? applied.slice(0, 80).map((item) => `| ${item.type || '-'} | ${item.source || '-'} | ${String(item.before || '-').replaceAll('|', '\\|')} | ${String(item.after || '-').replaceAll('|', '\\|')} | ${item.filePath || '-'} | ${item.nodeId || '-'} | ${item.confidence ?? '-'} |`)
      : ['| - | - | Nenhuma correcao aplicada | - | - | - | - |']),
    '',
    '## Acoes Ignoradas',
    '',
    '| Action | Tipo | Modo | Origem | Status | Motivo | Candidate |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...(skipped.length
      ? skipped.slice(0, 80).map((item) => `| ${item.actionId || '-'} | ${item.type || '-'} | ${item.mode || '-'} | ${item.source || '-'} | ${item.status || '-'} | ${item.reason || '-'} | ${item.candidateId || '-'} |`)
      : ['| - | Nenhuma acao ignorada | - | - | - | - | - |']),
    '',
  ];

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

function writeReviewQueueReports({ correctionPlan, semanticAudit, sourceDoc, xhtmlMap, chapterAlignment, createdAt }) {
  const reviewQueuePath = path.join(paths.stateDir, 'review-queue.json');
  const existingQueue = readJsonIfExists(reviewQueuePath);
  const reviewQueue = buildReviewQueue({
    correctionPlan,
    semanticAudit,
    existingQueue,
    xhtmlMap,
    sourceDoc,
    chapterAlignment,
    createdAt,
  });
  fs.writeFileSync(reviewQueuePath, JSON.stringify(reviewQueue, null, 2), 'utf8');

  const reviewQueueMarkdownPath = path.join(paths.reportsTxtDir, 'review-queue-latest.md');
  fs.writeFileSync(reviewQueueMarkdownPath, renderReviewQueueMarkdown(reviewQueue), 'utf8');

  return {
    reviewQueue,
    reviewQueuePath,
    reviewQueueMarkdownPath,
  };
}

async function writeAssistedReviewReports({ reviewQueue, createdAt }) {
  const modelAdapter = createOllamaAdapter();
  const { assistedReview, modelTrace } = await buildAssistedReviewSuggestions({
    reviewQueue,
    createdAt,
    modelAdapter,
  });
  const assistedReviewPath = path.join(paths.stateDir, 'assisted-review-suggestions.json');
  fs.writeFileSync(assistedReviewPath, JSON.stringify(assistedReview, null, 2), 'utf8');

  const assistedReviewMarkdownPath = path.join(paths.reportsTxtDir, 'assisted-review-suggestions-latest.md');
  fs.writeFileSync(assistedReviewMarkdownPath, renderAssistedReviewMarkdown(assistedReview), 'utf8');

  const assistedReviewModelTracePath = paths.assistedReviewModelTracePath;
  fs.writeFileSync(assistedReviewModelTracePath, JSON.stringify(modelTrace, null, 2), 'utf8');

  return {
    assistedReview,
    modelTrace,
    assistedReviewPath,
    assistedReviewMarkdownPath,
    assistedReviewModelTracePath,
  };
}

async function writeReports({ sourceDoc, translationDoc, logInfo, alignedDoc, issues, warnings, correctionCandidates, semanticAudit, xhtmlMap, chapterAlignment, glossary }) {
  const runDate = new Date();
  const timestamp = formatTimestampForFile(runDate);
  const isoTimestamp = runDate.toISOString();
  const status = statusFromIssues(issues, warnings);
  const serializedIssues = issues.map(serializeFinding);
  const serializedWarnings = warnings.map(serializeFinding);
  const manifest = loadEpubManifest(workflowRoot);
  const versionWorkflow = buildEpubVersionWorkflow(manifest, translationDoc.filePath);
  const workflowTrace = buildEpubWorkflowTrace(workflowRoot, manifest, translationDoc.filename);
  const correctionPlan = buildCorrectionPlan({
    workflowRoot,
    sourceDoc,
    translationDoc,
    logInfo,
    candidates: correctionCandidates,
    createdAt: isoTimestamp,
  });
  const report = {
    status,
    timestamp,
    stats: {
      timestamp,
      sourceFiles: 1,
      translatedFiles: 1,
      matchedFiles: 1,
      missingFiles: 0,
      totalIssues: issues.length,
      totalWarnings: warnings.length,
      failIssues: issues.filter((issue) => issue.severity === 'FAIL').length,
      warnIssues: issues.filter((issue) => issue.severity === 'WARN').length,
      ollamaReviews: 0,
      ollamaFails: 0,
      ollamaWarnings: 0,
      entityWarnings: 0,
      sourceFile: sourceDoc.filename,
      translatedFile: translationDoc.filename,
      sourceSections: sourceDoc.sections.length,
      translatedSections: translationDoc.sections.length,
      sourceParagraphs: sourceDoc.paragraphCount,
      translatedParagraphs: translationDoc.paragraphCount,
      sourceChars: sourceDoc.charCount,
      translatedChars: translationDoc.charCount,
      issues: issues.length,
      warnings: warnings.length,
      logTerms: logInfo.terms.length,
      logReplacements: logInfo.replacements.length,
    },
    summary: generateSummary(alignedDoc, issues, warnings),
    logInput: {
      file: logInfo.filePath,
      exists: logInfo.exists,
      terms: logInfo.terms,
      replacements: logInfo.replacements,
      notes: logInfo.notes.slice(0, 50),
      warnings: logInfo.warnings,
    },
    glossaryInput: {
      termsFile: paths.termsGlossaryPath,
      entitiesFile: paths.entitiesGlossaryPath,
      terms: glossary.terms.terms.length,
      entities: glossary.entities.entities.length,
    },
    correctionCandidates,
    semanticCandidates: semanticAudit.semanticCandidates,
    semanticSummary: semanticAudit.summary,
    correctionPlanSummary: correctionPlan.summary,
    issues: serializedIssues,
    warnings: serializedWarnings,
    ollamaResults: [],
    entityConsistency: {
      status: 'OK',
      aliasesFound: [],
      totalAliasOccurrences: 0,
      files: [],
      issues: [],
    },
    versionWorkflow,
    files: [serializeFile(alignedDoc)],
    epubAudit: {
      logInput: {
        file: logInfo.filePath,
        exists: logInfo.exists,
        terms: logInfo.terms,
        replacements: logInfo.replacements,
        warnings: logInfo.warnings,
      },
      glossaryInput: {
        termsFile: paths.termsGlossaryPath,
        entitiesFile: paths.entitiesGlossaryPath,
        terms: glossary.terms.terms.length,
        entities: glossary.entities.entities.length,
      },
      source: sourceDoc,
      translation: translationDoc,
      alignment: alignedDoc.chapters,
      chapterAlignment,
      xhtmlMap: {
        schemaVersion: xhtmlMap.schemaVersion,
        opfPath: xhtmlMap.opfPath,
        spine: xhtmlMap.spine,
        stats: xhtmlMap.stats,
      },
    },
    config: {
      thresholds: {
        minSectionRatio: 0.4,
        warnSectionRatio: 0.55,
        maxSectionCountDiffWarning: 2,
      },
      ollamaModel: null,
      optionalOllamaModel: null,
      workflow: 'audit-translation-epub',
    },
    workflowTrace,
  };

  const jsonPath = path.join(paths.reportsJsonDir, `audit-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  pruneOldAuditReports(jsonPath);
  const correctionPlanPath = path.join(paths.stateDir, 'correction-plan.json');
  fs.writeFileSync(correctionPlanPath, JSON.stringify(correctionPlan, null, 2), 'utf8');
  const semanticCandidatesPath = path.join(paths.stateDir, 'semantic-candidates.json');
  fs.writeFileSync(semanticCandidatesPath, JSON.stringify(semanticAudit, null, 2), 'utf8');
  const { reviewQueue, reviewQueuePath, reviewQueueMarkdownPath } = writeReviewQueueReports({
    correctionPlan,
    semanticAudit,
    sourceDoc,
    xhtmlMap,
    chapterAlignment,
    createdAt: isoTimestamp,
  });
  const {
    assistedReview,
    assistedReviewPath,
    assistedReviewMarkdownPath,
    assistedReviewModelTracePath,
  } = await writeAssistedReviewReports({
    reviewQueue,
    createdAt: isoTimestamp,
  });
  report.assistedReviewSummary = assistedReview.summary;
  report.config.optionalOllamaModel = assistedReview.modelAssistance.model;
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  appendWorkflowEvent('AUDIT_REPORT_CREATED', {
    status,
    issues: issues.length,
    warnings: warnings.length,
    report: path.relative(workflowRoot, jsonPath).replaceAll('\\', '/'),
    correctionPlan: path.relative(workflowRoot, correctionPlanPath).replaceAll('\\', '/'),
    semanticCandidates: path.relative(workflowRoot, semanticCandidatesPath).replaceAll('\\', '/'),
    reviewQueue: path.relative(workflowRoot, reviewQueuePath).replaceAll('\\', '/'),
    assistedReview: path.relative(workflowRoot, assistedReviewPath).replaceAll('\\', '/'),
    assistedReviewModelTrace: path.relative(workflowRoot, assistedReviewModelTracePath).replaceAll('\\', '/'),
    correctionCandidates: correctionCandidates.length,
    semanticCandidatesCount: semanticAudit.summary.total,
    reviewQueueItems: reviewQueue.summary.totalItems,
    reviewQueueSemanticItems: reviewQueue.summary.semanticAuditItems,
    assistedReviewSuggestions: assistedReview.summary.totalSuggestions,
    assistedReviewOllamaSuggestions: assistedReview.summary.ollamaSuggestions,
    assistedReviewFallbackSuggestions: assistedReview.summary.deterministicFallback,
    source: sourceDoc.filename,
    translation: translationDoc.filename,
    timestamp: isoTimestamp,
  });
  const dashboardHtmlPath = path.join(paths.reportsHtmlDir, 'audit-dashboard-latest.html');
  const validationHtmlPath = path.join(paths.reportsHtmlDir, 'validation-report-latest.html');
  const readerHtmlPath = path.join(paths.reportsHtmlDir, 'reader-report-latest.html');
  writeEpubHtmlDashboard(report, dashboardHtmlPath, {
    logsDir: paths.reportsJsonDir,
    stateDir: paths.stateDir,
    traceDir: paths.logsDir,
    sourceDocs: [sourceDoc],
    translatedDocs: [translationDoc],
    alignedDocs: [alignedDoc],
    relativeWorkflowPath,
  });
  writeEpubValidationTabsDashboard(report, validationHtmlPath, {
    logsDir: paths.reportsJsonDir,
    stateDir: paths.stateDir,
    traceDir: paths.logsDir,
    relativeWorkflowPath,
  });
  writeEpubReaderReport(report, readerHtmlPath, {
    stateDir: paths.stateDir,
    relativeWorkflowPath,
  });

  const findings = issues
    .concat(warnings)
    .slice(0, 80)
    .map((item) => `- [${item.severity}] ${item.type}: ${item.description || JSON.stringify(item.details || {})}`);

  const summaryLines = [
    'AUDITORIA DE TRADUCAO EPUB',
    `Status: ${status}`,
    `Original: ${sourceDoc.filename}`,
    `Traducao: ${translationDoc.filename}`,
    `Log TXT: ${logInfo.exists ? logInfo.filename : 'nao encontrado'}`,
    `Issues: ${issues.length}`,
    `Warnings: ${warnings.length}`,
    '',
    'INSUMOS DO LOG',
    `Termos: ${logInfo.terms.join(', ') || '-'}`,
    `Trocas: ${logInfo.replacements.map((r) => `${r.from} -> ${r.to}`).join('; ') || '-'}`,
    '',
    'CORRECTION PLAN',
    `Candidates: ${correctionCandidates.length}`,
    `Auto-safe: ${correctionPlan.summary.autoSafe}`,
    `Auto-review: ${correctionPlan.summary.autoReview}`,
    `Manual-only: ${correctionPlan.summary.manualOnly}`,
    `Correction plan: ${correctionPlanPath}`,
    '',
    'SEMANTIC CANDIDATES',
    `Total: ${semanticAudit.summary.total}`,
    `High: ${semanticAudit.summary.severity.high}`,
    `Medium: ${semanticAudit.summary.severity.medium}`,
    `Low: ${semanticAudit.summary.severity.low}`,
    `Semantic candidates: ${semanticCandidatesPath}`,
    `Review queue: ${reviewQueuePath}`,
    `Review queue items: ${reviewQueue.summary.totalItems}`,
    `Review queue semantic items: ${reviewQueue.summary.semanticAuditItems}`,
    `Assisted review: ${assistedReviewPath}`,
    `Assisted review trace: ${assistedReviewModelTracePath}`,
    `Assisted review Ollama: ${assistedReview.summary.ollamaSuggestions}`,
    `Assisted review fallback: ${assistedReview.summary.deterministicFallback}`,
    '',
    'PRINCIPAIS ACHADOS',
    ...(findings.length ? findings : ['- Nenhum achado.']),
    '',
    `JSON completo: ${jsonPath}`,
    `Dashboard HTML: ${dashboardHtmlPath}`,
    `Validacao: ${validationHtmlPath}`,
    `Relatorio editorial: ${readerHtmlPath}`,
  ];

  const summaryPath = path.join(paths.reportsTxtDir, 'epub-audit-summary-latest.txt');
  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf8');
  const correctionMarkdownPath = path.join(paths.reportsTxtDir, 'correction-report-latest.md');
  writeCorrectionMarkdownReport(correctionMarkdownPath);

  return {
    report,
    jsonPath,
    correctionPlanPath,
    semanticCandidatesPath,
    reviewQueuePath,
    reviewQueueMarkdownPath,
    assistedReviewPath,
    assistedReviewMarkdownPath,
    assistedReviewModelTracePath,
    dashboardHtmlPath,
    validationHtmlPath,
    readerHtmlPath,
    summaryPath,
    correctionMarkdownPath,
  };
}

async function main() {
  ensureDirs();
  const args = parseArgs(process.argv.slice(2));

  const sourceDoc = args.source ? readEpubFile(args.source) : readFirstEpubFromDir(paths.sourceDir);
  const translationDoc = args.translated ? readEpubFile(args.translated) : readFirstEpubFromDir(paths.translatedDir);
  const logInfo = readTranslationLog(args.log || readFirstTxtFromDir(paths.translationLogInputDir));

  if (!sourceDoc) throw new Error(`Nenhum EPUB original encontrado em ${paths.sourceDir}`);
  if (!translationDoc) throw new Error(`Nenhum EPUB traduzido encontrado em ${paths.translatedDir}`);

  console.log('=== INICIANDO AUDITORIA DE TRADUCAO EPUB ===');
  console.log(`Original: ${sourceDoc.filePath}`);
  console.log(`Traducao: ${translationDoc.filePath}`);
  console.log(`Log TXT: ${logInfo.exists ? logInfo.filePath : 'nao encontrado'}`);

  const chapters = alignSections(sourceDoc, translationDoc);
  const alignedDoc = {
    source: sourceDoc,
    translation: translationDoc,
    alignment: 'matched',
    chapters,
    stats: {
      sourceChapters: sourceDoc.sections.length,
      translationChapters: translationDoc.sections.length,
      chapterCountDiff: Math.abs(sourceDoc.sections.length - translationDoc.sections.length),
      matchedChapters: chapters.filter((chapter) => chapter.matchType === 'matched').length,
    },
  };

  const allIssues = [];
  const allWarnings = [];

  const structural = runEpubStructuralChecks(sourceDoc, translationDoc, chapters);
  allIssues.push(...structural.issues);
  allWarnings.push(...structural.warnings);

  const content = runEpubContentChecks(sourceDoc, translationDoc, args.sourceLanguage);
  allIssues.push(...content.issues);
  allWarnings.push(...content.warnings);

  const language = runEpubLanguageChecks(translationDoc.rawText);
  allIssues.push(...language.issues);
  allWarnings.push(...language.warnings);

  const logAudit = auditLogAgainstTranslation(logInfo, sourceDoc, translationDoc);
  allIssues.push(...logAudit.issues);
  allWarnings.push(...logAudit.warnings);

  const xhtmlMap = buildXhtmlMap(translationDoc.filePath);
  const chapterAlignment = buildChapterAlignment(sourceDoc, translationDoc);
  const glossary = loadCorrectionGlossary({
    termsPath: paths.termsGlossaryPath,
    entitiesPath: paths.entitiesGlossaryPath,
  });
  const correctionCandidates = buildCorrectionCandidates({
    issues: allIssues,
    warnings: allWarnings,
    logInfo,
    translationDoc,
    xhtmlMap,
    glossary,
  });
  const semanticAudit = buildSemanticConsistencyAudit({
    sourceDoc,
    translationDoc,
    xhtmlMap,
    chapterAlignment,
    glossary,
  });

  const { report, jsonPath, dashboardHtmlPath, validationHtmlPath, readerHtmlPath, summaryPath } = await writeReports({
    sourceDoc,
    translationDoc,
    logInfo,
    alignedDoc,
    issues: allIssues,
    warnings: allWarnings,
    correctionCandidates,
    semanticAudit,
    xhtmlMap,
    chapterAlignment,
    glossary,
  });

  console.log('=== AUDITORIA EPUB CONCLUIDA ===');
  console.log(`Status: ${report.status}`);
  console.log(`Issues: ${allIssues.length} | Warnings: ${allWarnings.length}`);
  console.log(`Correction candidates: ${correctionCandidates.length}`);
  console.log(`Semantic candidates: ${semanticAudit.summary.total}`);
  console.log(`Resumo: ${summaryPath}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Dashboard: ${dashboardHtmlPath}`);
  console.log(`Validação: ${validationHtmlPath}`);
  console.log(`Relatório editorial: ${readerHtmlPath}`);

  process.exit(report.status === 'FAIL' ? 1 : 0);
}

main().catch((error) => {
  console.error(`Erro fatal: ${error.message}`);
  if (process.argv.includes('--verbose')) console.error(error);
  process.exit(1);
});
