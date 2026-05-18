// src/version/versionCore.js
// Funções core do versionamento (get/set step, list, etc.)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const currentStepFile = path.join(projectRoot, '.current-step');
const inputFixedDir = path.join(projectRoot, 'input-fixed');
const originalTranslatedDir = path.join(projectRoot, 'input', 'translatedGoogle');

if (!fs.existsSync(inputFixedDir)) {
  fs.mkdirSync(inputFixedDir, { recursive: true });
}

export function getCurrentStep() {
  if (fs.existsSync(currentStepFile)) {
    const step = parseInt(fs.readFileSync(currentStepFile, 'utf8').trim(), 10);
    return isNaN(step) ? 1 : step;
  }
  return 1;
}

export function setCurrentStep(step) {
  fs.writeFileSync(currentStepFile, String(step), 'utf8');
}

export function incrementStep() {
  const current = getCurrentStep();
  const next = current + 1;
  setCurrentStep(next);
  return next;
}

export function decrementStep() {
  const current = getCurrentStep();
  const prev = Math.max(1, current - 1);
  setCurrentStep(prev);
  return prev;
}

export function listVersions() {
  if (!fs.existsSync(inputFixedDir)) return [];
  
  const versions = fs.readdirSync(inputFixedDir)
    .filter(f => f.match(/^v\d+$/))
    .map(f => parseInt(f.substring(1), 10))
    .sort((a, b) => a - b);
  
  return versions;
}

export function getVersionPath(step, filename) {
  const versionDir = path.join(inputFixedDir, `v${step}`);
  return path.join(versionDir, filename);
}

export function versionExists(step, filename) {
  const versionPath = getVersionPath(step, filename);
  return fs.existsSync(versionPath);
}

export function ensureVersionDir(step) {
  const versionDir = path.join(inputFixedDir, `v${step}`);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }
  return versionDir;
}

export function getCorrectionSourcePath(step, filename) {
  const originalPath = path.join(originalTranslatedDir, filename);
  if (step <= 1) {
    return {
      sourcePath: originalPath,
      sourceType: 'original',
      step,
    };
  }

  const previousStep = step - 1;
  const previousPath = getVersionPath(previousStep, filename);
  if (fs.existsSync(previousPath)) {
    return {
      sourcePath: previousPath,
      sourceType: 'previous_version',
      step,
      previousStep,
    };
  }

  return {
    sourcePath: originalPath,
    sourceType: 'original_fallback',
    step,
    previousStep,
    reason: 'previous_version_not_found',
  };
}

export function createVersionFromFile(srcPath, filename, step) {
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ Arquivo não encontrado: ${srcPath}`);
    return false;
  }
  
  const versionDir = path.join(inputFixedDir, `v${step}`);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }
  
  const destPath = path.join(versionDir, filename);
  fs.copyFileSync(srcPath, destPath);
  console.log(`  📁 Versão v${step} criada: ${destPath}`);
  return true;
}