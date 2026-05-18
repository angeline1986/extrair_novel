import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getInputDir } from '../../../src/fix-gender/fixGenderOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const translatedGoogleDir = path.join(projectRoot, 'input', 'translatedGoogle');
const v1Dir = path.join(projectRoot, 'input-fixed', 'v1');
const testFilename = 'test-getInputDir.docx';

function writeFile(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `content-${path.basename(dir)}`);
}

function cleanupFile(dir, name) {
  const filePath = path.join(dir, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('getInputDir()', () => {
  beforeEach(() => {
    writeFile(translatedGoogleDir, testFilename);
    writeFile(v1Dir, testFilename);
  });

  afterEach(() => {
    cleanupFile(translatedGoogleDir, testFilename);
    cleanupFile(v1Dir, testFilename);
  });

  test('returns translatedGoogle path for step 1', () => {
    const result = getInputDir(1, testFilename);
    expect(result).toBe(path.join(translatedGoogleDir, testFilename));
  });

  test('returns previous fixed version path for step 2', () => {
    const result = getInputDir(2, testFilename);
    expect(result).toBe(path.join(v1Dir, testFilename));
  });

  test('falls back to translatedGoogle when previous version is missing', () => {
    cleanupFile(v1Dir, testFilename);
    const result = getInputDir(2, testFilename);
    expect(result).toBe(path.join(translatedGoogleDir, testFilename));
  });
});
