// src/version/versionIO.js
// Operações de I/O simplificadas

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getVersionPath, listVersions, getCurrentStep, setCurrentStep, ensureVersionDir } from './versionCore.js';
import { logWorkflowEvent } from '../observability/workflowLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const translatedDir = path.join(projectRoot, 'input', 'translatedGoogle');
const inputFixedDir = path.join(projectRoot, 'input-fixed');

export function restoreVersion(step, filename) {
  const versionPath = getVersionPath(step, filename);
  
  if (!fs.existsSync(versionPath)) {
    console.error(`❌ Versão v${step} não encontrada: ${versionPath}`);
    return false;
  }
  
  const destPath = path.join(translatedDir, filename);
  
  // Backup do atual (opcional, apenas informativo)
  if (fs.existsSync(destPath)) {
    console.log(`  📋 Original em ${destPath} será substituído`);
  }
  
  logWorkflowEvent('FILE_WRITE', {
    step,
    file: filename,
    action: 'restore',
    source: versionPath,
    destination: destPath,
    sizeBytes: fs.statSync(versionPath).size,
    overwrite: fs.existsSync(destPath)
  });
  
  fs.copyFileSync(versionPath, destPath);
  console.log(`  ✅ Restaurado v${step}: ${destPath}`);
  return true;
}

export function gotoVersion(targetStep, filename) {
  const versions = listVersions();
  
  if (targetStep < 1) {
    console.log(`⚠️ Step inválido: ${targetStep}. Deve ser >= 1.`);
    return false;
  }
  
  if (!versions.includes(targetStep)) {
    console.log(`⚠️ Versão v${targetStep} não encontrada.`);
    console.log(`   Versões disponíveis: ${versions.join(', ')}`);
    return false;
  }
  
  const success = restoreVersion(targetStep, filename);
  if (success) {
    setCurrentStep(targetStep);
    console.log(`\n✨ Restaurado para Step ${targetStep}`);
  }
  return success;
}

export function createVersionFromCurrent(filename, step) {
  const currentPath = path.join(inputFixedDir, 'current', filename);
  if (!fs.existsSync(currentPath)) {
    console.error(`❌ Arquivo current não encontrado: ${currentPath}`);
    return false;
  }

  const versionDir = ensureVersionDir(step);
  const destPath = path.join(versionDir, filename);
  fs.copyFileSync(currentPath, destPath);
  console.log(`  📁 Versão v${step} criada a partir de current: ${destPath}`);
  return true;
}

export function nextVersion(filename) {
  const currentStep = getCurrentStep();
  const nextStep = currentStep + 1;
  const versionDir = ensureVersionDir(nextStep);
  setCurrentStep(nextStep);
  console.log(`  📁 Pasta de versão criada: ${versionDir}`);
  console.log(`\n✨ Avançado para Step ${nextStep}`);
  return true;
}

export function prevVersion(filename) {
  const currentStep = getCurrentStep();
  if (currentStep <= 1) {
    console.log(`⚠️ Já está na versão inicial (v1)`);
    return false;
  }

  const prevStep = currentStep - 1;
  setCurrentStep(prevStep);
  console.log(`\n✨ Retornado para Step ${prevStep}`);
  return true;
}