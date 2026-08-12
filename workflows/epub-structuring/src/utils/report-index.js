import fs from 'fs-extra';
import path from 'node:path';

export async function listReportRuns(reportsDir) {
  if (!(await fs.pathExists(reportsDir))) return [];
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isRunId(entry.name)) continue;
    const runDir = path.join(reportsDir, entry.name);
    const runPath = path.join(runDir, 'data', 'run.json');
    if (!(await fs.pathExists(runPath))) continue;
    const run = await fs.readJson(runPath);
    runs.push({
      runId: entry.name,
      runDir,
      dataDir: path.join(runDir, 'data'),
      reportHtml: path.join(runDir, 'report.html'),
      runPath,
      run
    });
  }
  return runs.sort((a, b) => String(b.run.startedAt || b.runId).localeCompare(String(a.run.startedAt || a.runId)));
}

export function formatReportRunLine(item, index) {
  return [
    `  [${index}] ${formatRunDate(item.run.startedAt)}`,
    `      ${item.run.operationLabel || item.run.operation || item.runId} · ${formatRunStatus(item.run.status)}`
  ].join('\n');
}

export function formatRunStatus(status) {
  if (status === 'success') return '✓ SUCESSO';
  if (status === 'partial_success') return '⚠ COM AVISOS';
  if (status === 'blocked') return '⚠ BLOQUEADO';
  if (status === 'cancelled') return 'ℹ CANCELADO';
  if (status === 'failed') return '✗ FALHOU';
  if (status === 'running') return 'ℹ EM ANDAMENTO';
  return `ℹ ${String(status || 'DESCONHECIDO').toUpperCase()}`;
}

export function formatRunDate(value) {
  if (!value) return 'data indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function isRunId(value) {
  return /^\d{8}_\d{6}(?:_\d+)?$/.test(value);
}
