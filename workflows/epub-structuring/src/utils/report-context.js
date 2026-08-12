import fs from 'fs-extra';
import path from 'node:path';
import { renderHtmlReport } from './html-report-renderer.js';

export async function createReportContext({ root, operation, operationLabel, inputs = [], output = null }) {
  const startedAt = new Date();
  const runId = await createRunId(root, startedAt);
  const runDir = path.join(root, 'reports', runId);
  const dataDir = path.join(runDir, 'data');
  const context = {
    root,
    runId,
    runDir,
    dataDir,
    runFile: path.join(dataDir, 'run.json'),
    operation,
    operationLabel,
    startedAt: formatLocalIso(startedAt),
    finishedAt: null,
    status: 'running',
    inputs: inputs.map((input) => normalizeRunPath(root, input)),
    output: output ? normalizeRunPath(root, output) : null
  };

  await fs.ensureDir(dataDir);
  await writeRunFile(context);
  return context;
}

export async function finishReportContext(context, { status, output = context.output, error = null } = {}) {
  if (!context) return null;
  context.finishedAt = formatLocalIso(new Date());
  context.status = status || context.status;
  context.output = output ? normalizeRunPath(context.root, output) : null;
  if (error) {
    context.error = {
      message: error.message || String(error)
    };
  } else {
    delete context.error;
  }
  await writeRunFile(context);
  context.reportHtml = await renderHtmlReport(context);
  return context;
}

async function createRunId(root, date) {
  const base = formatRunId(date);
  let candidate = base;
  let counter = 2;
  while (await fs.pathExists(path.join(root, 'reports', candidate))) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  return candidate;
}

function formatRunId(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}${mm}${yyyy}_${hh}${min}${ss}`;
}

function formatLocalIso(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetRemainder = String(absOffset % 60).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}${sign}${offsetHours}:${offsetRemainder}`;
}

function normalizeRunPath(root, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? path.relative(root, value) : value;
}

async function writeRunFile(context) {
  await fs.writeJson(context.runFile, {
    runId: context.runId,
    startedAt: context.startedAt,
    finishedAt: context.finishedAt,
    operation: context.operation,
    operationLabel: context.operationLabel,
    status: context.status,
    inputs: context.inputs,
    output: context.output,
    ...(context.error ? { error: context.error } : {})
  }, { spaces: 2 });
}
