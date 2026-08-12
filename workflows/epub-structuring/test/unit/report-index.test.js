import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { formatReportRunLine, formatRunStatus, listReportRuns } from '../../src/utils/report-index.js';

test('report index lists executions from data/run.json newest first', async () => {
  const root = fixtureRoot();
  await writeRun(root, '12082026_101403', {
    runId: '12082026_101403',
    startedAt: '2026-08-12T10:14:03-03:00',
    operation: 'menu_option_10',
    operationLabel: 'Validar EPUB',
    status: 'partial_success',
    inputs: [],
    output: null
  });
  await writeRun(root, '12082026_103142', {
    runId: '12082026_103142',
    startedAt: '2026-08-12T10:31:42-03:00',
    operation: 'full_pipeline',
    operationLabel: 'Processamento completo',
    status: 'success',
    inputs: [],
    output: 'output/book.epub'
  });
  await fs.ensureDir(path.join(root, 'reports', 'old'));

  const runs = await listReportRuns(path.join(root, 'reports'));
  assert.equal(runs.length, 2);
  assert.equal(runs[0].runId, '12082026_103142');
  assert.equal(runs[1].runId, '12082026_101403');
  assert.equal(runs[0].reportHtml, path.join(root, 'reports', '12082026_103142', 'report.html'));
});

test('report index formats run lines for the report submenu', async () => {
  const root = fixtureRoot();
  await writeRun(root, '12082026_102218', {
    runId: '12082026_102218',
    startedAt: '2026-08-12T10:22:18-03:00',
    operation: 'merge',
    operationLabel: 'Juntar EPUBs',
    status: 'success',
    inputs: [],
    output: null
  });

  const [run] = await listReportRuns(path.join(root, 'reports'));
  const line = formatReportRunLine(run, 2);
  assert.match(line, /\[2\] 12\/08\/2026 10:22:18/);
  assert.match(line, /Juntar EPUBs · ✓ SUCESSO/);
});

test('report index maps run status labels', () => {
  assert.equal(formatRunStatus('success'), '✓ SUCESSO');
  assert.equal(formatRunStatus('partial_success'), '⚠ COM AVISOS');
  assert.equal(formatRunStatus('blocked'), '⚠ BLOQUEADO');
  assert.equal(formatRunStatus('failed'), '✗ FALHOU');
});

async function writeRun(root, runId, run) {
  const dataDir = path.join(root, 'reports', runId, 'data');
  await fs.ensureDir(dataDir);
  await fs.writeJson(path.join(dataDir, 'run.json'), run, { spaces: 2 });
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'report-index-'));
}
