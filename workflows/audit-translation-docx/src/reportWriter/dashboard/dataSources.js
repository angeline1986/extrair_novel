// src/reportWriter/dashboard/dataSources.js
// Leituras auxiliares usadas pelo dashboard HTML.

import fs from 'fs';
import path from 'path';

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function getLatestJsonReport(logsDir, currentTimestamp) {
  if (!fs.existsSync(logsDir)) return null;

  const candidates = fs.readdirSync(logsDir)
    .filter((file) => file.startsWith('audit-report-') && file.endsWith('.json'))
    .filter((file) => !currentTimestamp || !file.includes(currentTimestamp))
    .sort()
    .reverse();

  for (const file of candidates) {
    const report = readJsonSafe(path.join(logsDir, file));
    if (report) return report;
  }

  return null;
}

export function getLatestJsonReportByWorkingInput(logsDir, workingInputPart, currentReport = null) {
  const matches = (report) => report?.versionWorkflow?.workingInput?.includes(workingInputPart);

  if (matches(currentReport)) return currentReport;
  if (!fs.existsSync(logsDir)) return null;

  const candidates = fs.readdirSync(logsDir)
    .filter((file) => file.startsWith('audit-report-') && file.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of candidates) {
    const report = readJsonSafe(path.join(logsDir, file));
    if (matches(report)) return report;
  }

  return null;
}

export function getLatestNormalization(logsDir) {
  if (!fs.existsSync(logsDir)) return null;

  const file = fs.readdirSync(logsDir)
    .filter((name) => name.startsWith('entity-normalization-') && name.endsWith('.json'))
    .sort()
    .reverse()[0];

  return file ? readJsonSafe(path.join(logsDir, file)) : null;
}
