import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ensureWorkflowDirs, findSingleEpub, getInputDirs, parseCliOptions, resolveOptionalPdf } from '../../src/utils/file-utils.js';

test('parseCliOptions supports --no-pdf', () => {
  assert.deepEqual(parseCliOptions(['--no-pdf']), { noPdf: true, pdfPath: null });
});

test('parseCliOptions supports explicit --pdf path', () => {
  assert.deepEqual(parseCliOptions(['--pdf', '/tmp/book.pdf']), { noPdf: false, pdfPath: '/tmp/book.pdf' });
  assert.deepEqual(parseCliOptions(['--pdf=/tmp/book.pdf']), { noPdf: false, pdfPath: '/tmp/book.pdf' });
});

test('resolveOptionalPdf does not choose arbitrarily when more than one PDF exists', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-structuring-pdf-'));
  await fs.writeFile(path.join(dir, 'a.pdf'), '');
  await fs.writeFile(path.join(dir, 'b.pdf'), '');

  await assert.rejects(() => resolveOptionalPdf(dir), /Mais de um PDF/);
  await fs.remove(dir);
});

test('resolveOptionalPdf ignores PDFs when --no-pdf is active', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-structuring-pdf-'));
  await fs.writeFile(path.join(dir, 'a.pdf'), '');

  assert.equal(await resolveOptionalPdf(dir, { noPdf: true }), null);
  await fs.remove(dir);
});

test('ensureWorkflowDirs creates semantic input directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-structuring-dirs-'));

  await ensureWorkflowDirs(root);

  assert.equal(await fs.pathExists(path.join(root, 'input', 'books')), true);
  assert.equal(await fs.pathExists(path.join(root, 'input', 'reference-files')), true);
  assert.equal(await fs.pathExists(path.join(root, 'input', 'validation-baseline')), true);
  assert.equal(await fs.pathExists(path.join(root, 'output')), true);
  assert.equal(await fs.pathExists(path.join(root, 'reports')), true);
  await fs.remove(root);
});

test('findSingleEpub only sees the directory it receives', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-structuring-input-'));
  const { booksDir, referenceFilesDir } = getInputDirs(root);
  await fs.ensureDir(booksDir);
  await fs.ensureDir(referenceFilesDir);
  await fs.writeFile(path.join(booksDir, 'book.epub'), '');
  await fs.writeFile(path.join(referenceFilesDir, 'reference.epub'), '');

  assert.equal(await findSingleEpub(booksDir), path.join(booksDir, 'book.epub'));
  await fs.remove(root);
});
