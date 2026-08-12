import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { cleanReports, previewReportCleanup } from '../../src/utils/report-cleaner.js';

test('report cleaner works with empty reports and preserves gitkeep', async () => {
  const root = fixtureRoot();
  await fs.ensureDir(path.join(root, 'reports'));
  await fs.writeFile(path.join(root, 'reports', '.gitkeep'), '');

  const result = await cleanReports(root, { confirm: true });
  assert.equal(result.status, 'cleaned');
  assert.equal(result.deletedCount, 0);
  assert.equal(await fs.pathExists(path.join(root, 'reports', '.gitkeep')), true);
});

test('report cleaner cancellation deletes nothing by default', async () => {
  const root = fixtureRoot();
  await writeReportRun(root, '12082026_100000');

  const result = await cleanReports(root);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.deletedCount, 0);
  assert.equal(await fs.pathExists(path.join(root, 'reports', '12082026_100000', 'data', 'run.json')), true);
});

test('report cleaner removes report contents only after explicit confirmation', async () => {
  const root = fixtureRoot();
  await writeReportRun(root, '12082026_100000');
  await writeReportRun(root, '12082026_101000');
  await fs.writeFile(path.join(root, 'reports', 'legacy.json'), 'legacy');
  await fs.writeFile(path.join(root, 'reports', '.gitkeep'), '');
  await fs.ensureDir(path.join(root, 'input', 'books'));
  await fs.ensureDir(path.join(root, 'output'));
  await fs.writeFile(path.join(root, 'input', 'books', 'book.epub'), 'input');
  await fs.writeFile(path.join(root, 'output', 'book.epub'), 'output');

  const preview = await previewReportCleanup(root);
  assert.equal(preview.entryCount, 3);
  assert.ok(preview.totalBytes > 0);

  const result = await cleanReports(root, { confirm: true });
  assert.equal(result.status, 'cleaned');
  assert.equal(result.deletedCount, 3);
  assert.ok(result.freedBytes > 0);
  assert.equal(await fs.pathExists(path.join(root, 'reports', '.gitkeep')), true);
  assert.equal(await fs.pathExists(path.join(root, 'reports', 'legacy.json')), false);
  assert.equal(await fs.pathExists(path.join(root, 'reports', '12082026_100000')), false);
  assert.equal(await fs.pathExists(path.join(root, 'input', 'books', 'book.epub')), true);
  assert.equal(await fs.pathExists(path.join(root, 'output', 'book.epub')), true);
});

test('report cleaner ignores symlinks inside reports and refuses reports symlink', async () => {
  const root = fixtureRoot();
  const outside = path.join(root, 'outside.txt');
  await fs.writeFile(outside, 'do not delete');
  await fs.ensureDir(path.join(root, 'reports'));
  await fs.symlink(outside, path.join(root, 'reports', 'outside-link'));

  const result = await cleanReports(root, { confirm: true });
  assert.equal(result.deletedCount, 0);
  assert.equal(await fs.pathExists(outside), true);
  assert.equal(await fs.pathExists(path.join(root, 'reports', 'outside-link')), true);

  const symlinkRoot = fixtureRoot();
  const target = path.join(symlinkRoot, 'target-reports');
  await fs.ensureDir(target);
  await fs.remove(path.join(symlinkRoot, 'reports'));
  await fs.symlink(target, path.join(symlinkRoot, 'reports'));
  await assert.rejects(() => previewReportCleanup(symlinkRoot), /REPORTS_DIR_SYMLINK_REFUSED/);
});

async function writeReportRun(root, runId) {
  const dataDir = path.join(root, 'reports', runId, 'data');
  await fs.ensureDir(dataDir);
  await fs.writeJson(path.join(dataDir, 'run.json'), { runId, status: 'success' });
  await fs.writeFile(path.join(root, 'reports', runId, 'report.html'), '<html></html>');
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'report-cleaner-'));
}
