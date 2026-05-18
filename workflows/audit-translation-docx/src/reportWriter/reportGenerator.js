// src/reportWriter/index.js
// Ponto de entrada para geração de relatórios

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatTimestamp, determineConsolidatedStatus } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
import { serializeIssue, serializeWarning, serializeOllamaResult, serializeFile, generateSummary } from './serializers.js';
import { writeIssuesCsv } from './csvWriter.js';
import { writeTextSummary } from './textWriter.js';
import { writeProblematicChaptersReport } from './detailsWriter.js';
import { writeHtmlDashboard } from './htmlWriter.js';

export function generateReports({
  sourceDocs,
  translatedDocs,
  alignedDocs,
  allIssues,
  allWarnings,
  ollamaResults = [],
  entityResults = [],
  versionWorkflow = null,
  config,
}) {
  const timestamp = formatTimestamp();
  const logsDir = config.files.logsDir;
  const outputDir = config.files.outputDir;
  const entityConsistency = buildEntityConsistency(entityResults);

  const stats = {
    timestamp,
    sourceFiles: sourceDocs.length,
    translatedFiles: translatedDocs.length,
    matchedFiles: alignedDocs.filter((d) => d.alignment === "matched").length,
    missingFiles: alignedDocs.filter((d) => d.alignment === "missing").length,
    totalIssues: allIssues.length,
    totalWarnings: allWarnings.length,
    failIssues: allIssues.filter((i) => i.severity === "FAIL").length,
    warnIssues: allIssues.filter((i) => i.severity === "WARN").length,
    ollamaReviews: ollamaResults.length,
    ollamaFails: ollamaResults.filter((r) => r.review?.status === "fail").length,
    ollamaWarnings: ollamaResults.filter((r) => r.review?.status === "warning").length,
    entityWarnings: entityConsistency.issues.length,
  };

  const consolidatedStatus = determineConsolidatedStatus(stats);

  const report = {
    status: consolidatedStatus,
    stats,
    summary: generateSummary(alignedDocs, allIssues, allWarnings, ollamaResults),
    issues: allIssues.map(serializeIssue),
    warnings: allWarnings.map(serializeWarning),
    ollamaResults: ollamaResults.map(serializeOllamaResult),
    entityConsistency,
    versionWorkflow,
    files: alignedDocs.map((doc) => serializeFile(doc)),
    config: {
      thresholds: config.thresholds,
      ollamaModel: config.ollama.model,
    },
  };

  const workflowEventsFile = path.join(projectRoot, 'logs', 'workflow-events.jsonl');
  if (fs.existsSync(workflowEventsFile)) {
    const events = fs.readFileSync(workflowEventsFile, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));

    const lastRun = events.filter((e) => e.event === 'WORKFLOW_STARTED').slice(-1)[0];
    const versionEvents = events.filter((e) => e.event === 'VERSION_CREATED' || e.event === 'VERSION_MISSING_GAP');
    const writes = events.filter((e) => e.event === 'FILE_WRITE');
    const deletes = events.filter((e) => e.event === 'FILE_DELETE');

    const versionsFound = [];
    for (let i = 1; i <= 10; i++) {
      const vPath = path.join(projectRoot, 'input-fixed', `v${i}`);
      if (fs.existsSync(vPath)) versionsFound.push(`v${i}`);
    }

    const allExpected = versionsFound.length > 0
      ? Array.from({ length: Math.max(...versionsFound.map((v) => parseInt(v.substring(1))), 0) }, (_, i) => `v${i + 1}`)
      : [];
    const missing = allExpected.filter((v) => !versionsFound.includes(v));

    report.workflowTrace = {
      currentStep: lastRun?.currentStep || null,
      versionsFound,
      versionsCreated: versionEvents.filter((e) => e.event === 'VERSION_CREATED').map((e) => e.version || `v${e.step}`),
      versionsMissing: missing,
      writes: writes.slice(-10),
      deletes: deletes.slice(-5),
      warnings: versionEvents.filter((e) => e.event === 'VERSION_MISSING_GAP').map((e) => e.details?.explanation || 'VERSION_MISSING_GAP'),
    };
  }

  // JSON
  const jsonPath = path.join(logsDir, `audit-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`📄 JSON: ${jsonPath}`);

  // Dashboard HTML
  const htmlPath = path.join(logsDir, `audit-dashboard-${timestamp}.html`);
  writeHtmlDashboard(report, htmlPath, {
    logsDir,
    sourceDocs,
    translatedDocs,
    alignedDocs,
  });
  fs.copyFileSync(htmlPath, path.join(logsDir, 'audit-dashboard-latest.html'));
  console.log(`🧭 Dashboard: ${htmlPath}`);

  // CSV
  if (allIssues.length > 0 || allWarnings.length > 0) {
    const csvPath = path.join(logsDir, `issues-${timestamp}.csv`);
    writeIssuesCsv(allIssues, allWarnings, csvPath, config.report.csvDelimiter);
    console.log(`📊 CSV: ${csvPath}`);
  }

  if (entityConsistency.issues.length > 0) {
    const entityPath = path.join(logsDir, `entity-consistency-${timestamp}.json`);
    fs.writeFileSync(entityPath, JSON.stringify({
      timestamp,
      status: entityConsistency.status,
      aliasesFound: entityConsistency.aliasesFound,
      totalAliasOccurrences: entityConsistency.totalAliasOccurrences,
      files: entityConsistency.files,
      issues: entityConsistency.issues.map((issue) => ({
        ...issue,
        action: "suggest_replace",
      })),
    }, null, 2), "utf8");
    console.log(`🏷️  Entidades: ${entityPath}`);
  }

  // Resumo em texto
  const summaryPath = path.join(logsDir, `audit-summary-${timestamp}.txt`);
  writeTextSummary(report, summaryPath, sourceDocs, translatedDocs);
  console.log(`📝 Resumo: ${summaryPath}`);

  // Detalhes de capítulos problemáticos
  if (stats.failIssues > 0 || stats.ollamaFails > 0) {
    const detailsPath = path.join(logsDir, `problematic-chapters-${timestamp}.txt`);
    writeProblematicChaptersReport(alignedDocs, ollamaResults, detailsPath);
    console.log(`⚠️  Detalhes: ${detailsPath}`);
  }

  return report;
}

function buildEntityConsistency(entityResults) {
  const issues = entityResults.flatMap((result) =>
    result.entityIssues.map((issue) => ({
      file: result.file,
      sourceFile: result.sourceFile,
      translatedFile: result.translatedFile,
      type: issue.type,
      severity: issue.severity,
      canonical: issue.canonical,
      found: issue.found,
      occurrences: issue.occurrences,
      suggestion: issue.suggestion,
    }))
  );

  return {
    status: issues.length > 0 ? "WARN" : "OK",
    aliasesFound: issues.length,
    totalAliasOccurrences: issues.reduce((sum, issue) => sum + issue.occurrences, 0),
    issues,
    files: entityResults.map((result) => ({
      file: result.file,
      sourceFile: result.sourceFile,
      translatedFile: result.translatedFile,
      status: result.status,
      sourceEntityCandidates: result.sourceEntityCandidates,
      canonicalPresence: result.canonicalPresence,
      aliasesFound: result.summary.aliasesFound,
      totalAliasOccurrences: result.summary.totalAliasOccurrences,
      issues: result.entityIssues,
    })),
  };
}
