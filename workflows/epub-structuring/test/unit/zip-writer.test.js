import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { auditZipMimetype, writeZipFile } from '../../src/utils/zip-writer.js';

test('writeZipFile stores mimetype as first uncompressed entry', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-zip-'));
  const file = path.join(dir, 'book.epub');

  writeZipFile(file, [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), store: true },
    { name: 'OEBPS/chapter_001.xhtml', data: Buffer.from('<html/>') }
  ]);

  const audit = auditZipMimetype(file);
  const zip = new AdmZip(file);
  assert.equal(audit.firstEntry, 'mimetype');
  assert.equal(audit.compressionMethod, 0);
  assert.equal(audit.zipMimetypeOk, true);
  assert.equal(zip.getEntry('mimetype').header.method, 0);

  await fs.remove(dir);
});
