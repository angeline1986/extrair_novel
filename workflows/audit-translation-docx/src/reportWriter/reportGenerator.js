// src/reportWriter/index.js
// Ponto de entrada para geração de relatórios

import fs from 'fs';
import path from 'path';
import { formatTimestamp, determineConsolidatedStatus } from './utils.js';
import { serializeIssue, serializeWarning, serializeOllamaResult, serializeFile, generateSummary } from './serializers.js';
import { writeIssuesCsv } from './csvWriter.js';
import { writeTextSummary } from './textWriter.js';
import { writeProblematicChaptersReport } from './detailsWriter.js';

export function generateReports({
  sourceDocs,
  translatedDocs,
  alignedDocs,
  allIssues,
  allWarnings,
  ollamaResults = [],
  config,
}) {
  const timestamp = formatTimestamp();
  const logsDir = config.files.logsDir;
  const outputDir = config.files.outputDir;

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
  };

  const consolidatedStatus = determineConsolidatedStatus(stats);

  const report = {
    status: consolidatedStatus,
    stats,
    summary: generateSummary(alignedDocs, allIssues, allWarnings, ollamaResults),
    issues: allIssues.map(serializeIssue),
    warnings: allWarnings.map(serializeWarning),
    ollamaResults: ollamaResults.map(serializeOllamaResult),
    files: alignedDocs.map((doc) => serializeFile(doc)),
    config: {
      thresholds: config.thresholds,
      ollamaModel: config.ollama.model,
    },
  };

  // JSON
  const jsonPath = path.join(logsDir, `audit-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`📄 JSON: ${jsonPath}`);

  // CSV
  if (allIssues.length > 0 || allWarnings.length > 0) {
    const csvPath = path.join(logsDir, `issues-${timestamp}.csv`);
    writeIssuesCsv(allIssues, allWarnings, csvPath, config.report.csvDelimiter);
    console.log(`📊 CSV: ${csvPath}`);
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