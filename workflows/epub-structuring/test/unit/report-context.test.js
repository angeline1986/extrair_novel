import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { createReportContext, finishReportContext } from '../../src/utils/report-context.js';
import { renderHtmlReport } from '../../src/utils/html-report-renderer.js';

test('report context creates one run directory with stable operation and UI label', async () => {
  const root = fixtureRoot();
  const context = await createReportContext({
    root,
    operation: 'full_pipeline',
    operationLabel: 'Processamento completo',
    inputs: [path.join(root, 'input', 'books', 'book.epub')]
  });

  assert.match(context.runId, /^\d{8}_\d{6}$/);
  assert.equal(context.runDir, path.join(root, 'reports', context.runId));
  assert.equal(context.dataDir, path.join(context.runDir, 'data'));

  const initialRun = await fs.readJson(context.runFile);
  assert.equal(initialRun.operation, 'full_pipeline');
  assert.equal(initialRun.operationLabel, 'Processamento completo');
  assert.equal(initialRun.status, 'running');
  assert.equal(initialRun.finishedAt, null);
  assert.deepEqual(initialRun.inputs, ['input/books/book.epub']);

  await finishReportContext(context, {
    status: 'success',
    output: path.join(root, 'output', 'book-structured.epub')
  });

  const finishedRun = await fs.readJson(context.runFile);
  assert.equal(finishedRun.status, 'success');
  assert.equal(finishedRun.output, 'output/book-structured.epub');
  assert.match(finishedRun.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(fs.existsSync(path.join(context.runDir, 'report.html')), true);
});

test('report context avoids runId collisions within the same second', async () => {
  const root = fixtureRoot();
  const first = await createReportContext({ root, operation: 'one', operationLabel: 'One' });
  const second = await createReportContext({ root, operation: 'two', operationLabel: 'Two' });

  assert.notEqual(first.runId, second.runId);
  assert.match(second.runId, /^\d{8}_\d{6}(?:_\d+)?$/);
});

test('html report renderer consumes run metadata and available data reports', async () => {
  const root = fixtureRoot();
  const context = await createReportContext({
    root,
    operation: 'menu_option_1',
    operationLabel: 'Analisar EPUB',
    inputs: ['input/books/book.epub']
  });
  await fs.writeJson(path.join(context.dataDir, 'chapter_report.json'), { chapterCount: 12, chapters: [] });
  await fs.writeJson(path.join(context.dataDir, 'toc_report.json'), { entryCount: 12, entries: [] });
  await fs.writeJson(path.join(context.dataDir, 'validation_report.json'), { ok: true, issues: [] });
  await finishReportContext(context, { status: 'success', output: 'reports/example.json' });

  const reportPath = await renderHtmlReport(context);
  const html = await fs.readFile(reportPath, 'utf8');
  assert.match(html, /<!doctype html>/);
  assert.match(html, /Analisar EPUB/);
  assert.match(html, /Resultado/);
  assert.match(html, /Diagnóstico/);
  assert.match(html, /Próximas Ações Sugeridas/);
  assert.match(html, /input\/books\/book\.epub/);
  assert.match(html, /chapter_report\.json/);
  assert.match(html, /Capítulos/);
  assert.match(html, />12</);
  assert.doesNotMatch(html, /https?:\/\//);
});

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'report-context-'));
}
