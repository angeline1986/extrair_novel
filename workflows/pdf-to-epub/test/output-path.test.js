import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';

import { buildRunOutputPath, resolveOutputFilePath } from '../src/utils/file-utils.js';

test('buildRunOutputPath creates unique names and avoids overwriting older EPUBs', () => {
  const first = buildRunOutputPath('/tmp/workflow', 'book', '.epub');
  const second = buildRunOutputPath('/tmp/workflow', 'book', '.epub');

  assert.match(first, /book-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  assert.ok(first.endsWith('.epub'));
  assert.notEqual(first, second);
});

test('resolveOutputFilePath creates a new name when user selects a new file', async () => {
  const tempRoot = '/tmp/pdf-to-epub-output-choice';
  await fs.ensureDir(tempRoot);
  const originalPath = `${tempRoot}/book.epub`;
  await fs.writeFile(originalPath, 'existing');

  const resolved = await resolveOutputFilePath(tempRoot, 'book', '.epub', async () => '2');

  assert.notEqual(resolved, originalPath);
  assert.match(resolved, /book-.*\.epub$/);
  await fs.remove(tempRoot);
});

test('resolveOutputFilePath keeps the original name when user chooses overwrite', async () => {
  const tempRoot = '/tmp/pdf-to-epub-output-overwrite';
  await fs.ensureDir(tempRoot);
  const originalPath = `${tempRoot}/book.epub`;
  await fs.writeFile(originalPath, 'existing');

  const resolved = await resolveOutputFilePath(tempRoot, 'book', '.epub', async () => '1');

  assert.equal(resolved, originalPath);
  await fs.remove(tempRoot);
});
