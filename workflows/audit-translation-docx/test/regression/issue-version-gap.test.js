import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getInputDir } from '../../src/fix-gender/fixGenderOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const translatedGoogleDir = path.join(projectRoot, 'input', 'translatedGoogle');
const v1Dir = path.join(projectRoot, 'input-fixed', 'v1');
const testFilename = 'regression-version-gap.docx';

function ensureFile(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), 'fixture');
}

function cleanupFile(dir, name) {
  const filePath = path.join(dir, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('regression: incremental gender correction source', () => {
  beforeAll(() => {
    ensureFile(translatedGoogleDir, testFilename);
    ensureFile(v1Dir, testFilename);
  });

  afterAll(() => {
    cleanupFile(translatedGoogleDir, testFilename);
    cleanupFile(v1Dir, testFilename);
  });

  test('step 2 selects v1 source instead of original translatedGoogle', () => {
    const pathForStep2 = getInputDir(2, testFilename);
    expect(pathForStep2).toBe(path.join(v1Dir, testFilename));
  });
});
