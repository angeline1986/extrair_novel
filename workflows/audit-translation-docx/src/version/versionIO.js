// src/version/versionIO.js
// Operações de I/O: criar, restaurar, limpar versões

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getVersionPath, listVersions, getCurrentStep, setCurrentStep } from './versionCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Carregar configuração
let config;
try {
  const configModule = await import('../config.js');
  config = configModule.default;
} catch (err) {
  config = {
    files: {
      translatedDir: path.join(projectRoot, 'input', 'translated'),
      backupDir: path.join(projectRoot, 'input', 'backup'),
    },
    versioning: {
      inputFixedDir: path.join(projectRoot, 'input-fixed'),
    },
  };
}

const translatedDir = config.files.translatedDir;
const backupDir = config.files.backupDir;
const inputFixedDir = config.versioning.inputFixedDir || path.join(projectRoot, 'input-fixed');

// Garantir que o diretório de backup existe
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Criar uma nova versão a partir do arquivo atual em input/translated/
 * @param {string} filename - Nome do arquivo
 * @param {number} step - Número da versão (opcional)
 * @returns {boolean}
 */
export function createVersionFromCurrent(filename, step = null) {
  const targetStep = step || getCurrentStep();
  const sourcePath = path.join(translatedDir, filename);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Arquivo não encontrado: ${sourcePath}`);
    return false;
  }
  
  const versionDir = path.join(inputFixedDir, `v${targetStep}`);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }
  
  const destPath = path.join(versionDir, filename);
  fs.copyFileSync(sourcePath, destPath);
  console.log(`  📁 Versão v${targetStep} criada: ${destPath}`);
  return true;
}

/**
 * Criar uma nova versão a partir de um arquivo corrigido
 * @param {string} srcPath - Caminho do arquivo corrigido
 * @param {string} filename - Nome do arquivo
 * @param {number} step - Número da versão
 * @returns {boolean}
 */
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

/**
 * Restaurar uma versão específica
 * @param {number} step - Número da versão
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
export function restoreVersion(step, filename) {
  const versionPath = getVersionPath(step, filename);
  
  if (!fs.existsSync(versionPath)) {
    console.error(`❌ Versão v${step} não encontrada: ${versionPath}`);
    return false;
  }
  
  const destPath = path.join(translatedDir, filename);
  
  // Backup do atual
  if (fs.existsSync(destPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(backupDir, `${filename}.restore-${timestamp}.backup`);
    fs.copyFileSync(destPath, backupPath);
    console.log(`  📋 Backup: ${backupPath}`);
  }
  
  fs.copyFileSync(versionPath, destPath);
  console.log(`  ✅ Restaurado v${step}: ${destPath}`);
  return true;
}

/**
 * Ir diretamente para um step específico
 * @param {number} targetStep - Step destino
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
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

/**
 * Avançar para o próximo step
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
export function nextVersion(filename) {
  const currentStep = getCurrentStep();
  const nextStep = currentStep + 1;
  
  const success = createVersionFromCurrent(filename, nextStep);
  if (success) {
    setCurrentStep(nextStep);
    console.log(`\n✨ Avançado para Step ${nextStep}`);
  }
  return success;
}

/**
 * Voltar para o step anterior
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
export function prevVersion(filename) {
  const currentStep = getCurrentStep();
  if (currentStep <= 1) {
    console.log(`⚠️ Já está na versão inicial (v1)`);
    return false;
  }
  
  const prevStep = currentStep - 1;
  const success = restoreVersion(prevStep, filename);
  if (success) {
    setCurrentStep(prevStep);
    console.log(`\n✨ Voltado para Step ${prevStep}`);
  }
  return success;
}

/**
 * Limpar versões antigas
 * @param {number} keepCount - Número de versões a manter
 * @param {string} filename - Nome do arquivo
 * @returns {number}
 */
export function cleanOldVersions(keepCount = 5, filename = null) {
  const versions = listVersions();
  
  if (versions.length <= keepCount) {
    console.log(`ℹ️ Nenhuma versão antiga para remover (${versions.length}/${keepCount})`);
    return 0;
  }
  
  const toDelete = versions.slice(0, versions.length - keepCount);
  let deleted = 0;
  
  for (const step of toDelete) {
    const versionDir = path.join(inputFixedDir, `v${step}`);
    if (fs.existsSync(versionDir)) {
      if (filename) {
        const filePath = path.join(versionDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`  🗑️ Removido: v${step}/${filename}`);
          deleted++;
        }
      } else {
        fs.rmSync(versionDir, { recursive: true, force: true });
        console.log(`  🗑️ Removido: v${step}/`);
        deleted++;
      }
    }
  }
  
  console.log(`\n✅ ${deleted} versão(ões) antiga(s) removida(s).`);
  return deleted;
}