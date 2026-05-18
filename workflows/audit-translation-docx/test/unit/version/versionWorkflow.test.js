import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const isolatedRoot = path.join(projectRoot, 'output', 'test-version-workflow-root');
const translatedGoogleDir = path.join(isolatedRoot, 'input', 'translatedGoogle');
const inputFixedDir = path.join(isolatedRoot, 'input-fixed');
const currentDir = path.join(inputFixedDir, 'current');
const manifestPath = path.join(inputFixedDir, 'manifest.json');
const tempDir = path.join(isolatedRoot, 'output', 'test-version-workflow');
const testFilename = 'version-workflow-test.docx';

let getNextVersion;
let getWorkingInput;
let loadManifest;
let publishVersion;

function writeFile(filePath, content = 'fixture') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function removePath(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

describe('versionWorkflow', () => {
  beforeEach(async () => {
    removePath(isolatedRoot);
    process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT = isolatedRoot;

    const module = await import(`../../../src/version/versionWorkflow.js?test=${Date.now()}`);
    getNextVersion = module.getNextVersion;
    getWorkingInput = module.getWorkingInput;
    loadManifest = module.loadManifest;
    publishVersion = module.publishVersion;
  });

  afterEach(() => {
    delete process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT;
    removePath(isolatedRoot);
  });

  test('uses translatedGoogle when current has no docx files', () => {
    writeFile(path.join(translatedGoogleDir, testFilename), 'original');
    const workingInput = getWorkingInput();

    expect(workingInput.relativePath).toBe('input/translatedGoogle');
    expect(workingInput.source).toBe('original');
  });

  test('uses input-fixed/current once a corrected docx exists', () => {
    writeFile(path.join(currentDir, testFilename), 'current');
    const workingInput = getWorkingInput();

    expect(workingInput.relativePath).toBe('input-fixed/current');
    expect(workingInput.source).toBe('current');
  });

  test('reset-working-copy forces translatedGoogle even when current exists', () => {
    writeFile(path.join(currentDir, testFilename), 'current');
    const workingInput = getWorkingInput({ resetWorkingCopy: true });

    expect(workingInput.relativePath).toBe('input/translatedGoogle');
    expect(workingInput.source).toBe('reset_original');
  });

  test('publishes next version and updates current plus manifest', () => {
    writeFile(path.join(inputFixedDir, 'v98', testFilename), 'old');
    const correctedFile = path.join(tempDir, testFilename);
    writeFile(correctedFile, 'corrected');

    expect(getNextVersion()).toBe(99);

    const published = publishVersion({
      source: path.join(inputFixedDir, 'v98'),
      correctedFile,
      version: 99,
      step: 99,
      metadata: { test: true },
    });

    expect(fs.readFileSync(published.versionDest, 'utf8')).toBe('corrected');
    expect(fs.readFileSync(published.currentDest, 'utf8')).toBe('corrected');

    const manifest = loadManifest();
    expect(manifest.currentVersion).toBe(99);
    expect(manifest.versions.at(-1)).toMatchObject({
      version: 99,
      source: 'input-fixed/v98',
      output: 'input-fixed/v99',
      step: 99,
    });
  });
});
