import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { parseCliOptions, resolveOptionalPdf } from '../../src/utils/file-utils.js';

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
