import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const isolatedRoot = path.join(projectRoot, 'output', 'test-step-by-step-versions-root');

const testFilename = 'integration-test.docx';
const inputDir = path.join(isolatedRoot, 'input', 'translatedGoogle');
const inputFixedDir = path.join(isolatedRoot, 'input-fixed');
const outputDir = path.join(isolatedRoot, 'output', 'fixed');
const testSourceFile = path.join(inputDir, testFilename);
const testContent = Buffer.from('test-content-v1');
let getCorrectionSourcePath;
let createVersionFromFile;
let setCurrentStep;

function cleanupState() {
  if (fs.existsSync(isolatedRoot)) {
    fs.rmSync(isolatedRoot, { recursive: true, force: true });
  }
}

function cleanupTestState() {
  // Remove test file
  if (fs.existsSync(testSourceFile)) {
    fs.unlinkSync(testSourceFile);
  }
  // Remove version dirs
  ['v1', 'v2', 'v3'].forEach(v => {
    const vdir = path.join(inputFixedDir, v);
    if (fs.existsSync(vdir)) {
      fs.rmSync(vdir, { recursive: true, force: true });
    }
  });
  // Remove current pointer
  const currentDir = path.join(inputFixedDir, 'current');
  if (fs.existsSync(currentDir)) {
    fs.rmSync(currentDir, { recursive: true, force: true });
  }
  // Clean output dir
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  setCurrentStep(1);
}

function ensureTestFile() {
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(testSourceFile, testContent);
}

function createTestFixedFile(step, content) {
  const outputPath = path.join(outputDir, `step${step}_test`, testFilename);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
  return outputPath;
}

function versionExists(step) {
  const versionFile = path.join(inputFixedDir, `v${step}`, testFilename);
  return fs.existsSync(versionFile);
}

function getVersionContent(step) {
  const versionFile = path.join(inputFixedDir, `v${step}`, testFilename);
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf8');
  }
  return null;
}

describe('integration: step-by-step version evolution', () => {
  beforeAll(async () => {
    cleanupState();
    process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT = isolatedRoot;
    const module = await import(`../../src/version/versionCore.js?test=${Date.now()}`);
    getCorrectionSourcePath = module.getCorrectionSourcePath;
    createVersionFromFile = module.createVersionFromFile;
    setCurrentStep = module.setCurrentStep;
    setCurrentStep(1);
    ensureTestFile();
  });

  afterAll(() => {
    cleanupState();
    delete process.env.AUDIT_TRANSLATION_WORKFLOW_ROOT;
  });

  test('step 1 creates v1 version from original input', () => {
    setCurrentStep(1);
    
    // Simulate fix:gender output for step 1
    const correctedPath = createTestFixedFile(1, 'corrected-v1');
    
    // Create version (as fix:gender would do)
    createVersionFromFile(correctedPath, testFilename, 1);
    
    // Verify v1 was created
    expect(versionExists(1)).toBe(true);
    expect(getVersionContent(1)).toBe('corrected-v1');
  });

  test('step 2 uses v1 as source and creates v2', () => {
    setCurrentStep(2);
    
    // Verify getCorrectionSourcePath returns v1 for step 2
    const sourceInfo = getCorrectionSourcePath(2, testFilename);
    expect(sourceInfo.sourceType).toBe('previous_version');
    expect(sourceInfo.sourcePath).toBe(path.join(inputFixedDir, 'v1', testFilename));
    
    // Simulate reading v1 and processing it
    const v1Content = getVersionContent(1);
    const correctedPath = createTestFixedFile(2, `corrected-${v1Content}`);
    
    // Create version (as fix:gender would do)
    createVersionFromFile(correctedPath, testFilename, 2);
    
    // Verify v2 was created from v1
    expect(versionExists(2)).toBe(true);
    expect(getVersionContent(2)).toBe('corrected-corrected-v1');
    
    // Verify v1 still exists
    expect(versionExists(1)).toBe(true);
  });

  test('step 3 uses v2 as source and creates v3', () => {
    setCurrentStep(3);
    
    // Verify getCorrectionSourcePath returns v2 for step 3
    const sourceInfo = getCorrectionSourcePath(3, testFilename);
    expect(sourceInfo.sourceType).toBe('previous_version');
    expect(sourceInfo.sourcePath).toBe(path.join(inputFixedDir, 'v2', testFilename));
    
    // Simulate reading v2 and processing it
    const v2Content = getVersionContent(2);
    const correctedPath = createTestFixedFile(3, `corrected-${v2Content}`);
    
    // Create version (as fix:gender would do)
    createVersionFromFile(correctedPath, testFilename, 3);
    
    // Verify v3 was created from v2
    expect(versionExists(3)).toBe(true);
    expect(getVersionContent(3)).toBe('corrected-corrected-corrected-v1');
    
    // Verify v1 and v2 still exist
    expect(versionExists(1)).toBe(true);
    expect(versionExists(2)).toBe(true);
  });

  test('complete chain: v1 -> v2 -> v3 incremental evolution', () => {
    // After all steps, verify the complete chain with content progression
    expect(getVersionContent(1)).toBe('corrected-v1');
    expect(getVersionContent(2)).toBe('corrected-corrected-v1');
    expect(getVersionContent(3)).toBe('corrected-corrected-corrected-v1');
  });
});
