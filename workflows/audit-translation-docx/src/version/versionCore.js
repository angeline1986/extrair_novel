// src/version/versionCore.js
// Funções core do versionamento (get/set step, list, etc.)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Carregar configuração
let config;
try {
  const configModule = await import('../config.js');
  config = configModule.default;
} catch (err) {
  config = {
    versioning: {
      currentStepFile: path.join(projectRoot, '.current-step'),
      inputFixedDir: path.join(projectRoot, 'input-fixed'),
    },
  };
}

const currentStepFile = config.versioning.currentStepFile;
const inputFixedDir = config.versioning.inputFixedDir || path.join(projectRoot, 'input-fixed');

// Garantir que o diretório existe
if (!fs.existsSync(inputFixedDir)) {
  fs.mkdirSync(inputFixedDir, { recursive: true });
}

/**
 * Obter o step atual (número da versão)
 * @returns {number} Step atual (1, 2, 3...)
 */
export function getCurrentStep() {
  if (fs.existsSync(currentStepFile)) {
    const step = parseInt(fs.readFileSync(currentStepFile, 'utf8').trim(), 10);
    return isNaN(step) ? 1 : step;
  }
  return 1;
}

/**
 * Salvar o step atual
 * @param {number} step - Novo step
 */
export function setCurrentStep(step) {
  fs.writeFileSync(currentStepFile, String(step), 'utf8');
}

/**
 * Incrementar step (avançar para próximo)
 * @returns {number} Novo step
 */
export function incrementStep() {
  const current = getCurrentStep();
  const next = current + 1;
  setCurrentStep(next);
  return next;
}

/**
 * Decrementar step (voltar para anterior)
 * @returns {number} Novo step
 */
export function decrementStep() {
  const current = getCurrentStep();
  const prev = Math.max(1, current - 1);
  setCurrentStep(prev);
  return prev;
}

/**
 * Listar todas as versões disponíveis
 * @returns {number[]} Array com os números das versões
 */
export function listVersions() {
  if (!fs.existsSync(inputFixedDir)) return [];
  
  const versions = fs.readdirSync(inputFixedDir)
    .filter(f => f.match(/^v\d+$/))
    .map(f => parseInt(f.substring(1), 10))
    .sort((a, b) => a - b);
  
  return versions;
}

/**
 * Obter o caminho de uma versão específica
 * @param {number} step - Número da versão (1, 2, 3...)
 * @param {string} filename - Nome do arquivo
 * @returns {string} Caminho completo para a versão
 */
export function getVersionPath(step, filename) {
  const versionDir = path.join(inputFixedDir, `v${step}`);
  return path.join(versionDir, filename);
}

/**
 * Verificar se uma versão existe
 * @param {number} step - Número da versão
 * @param {string} filename - Nome do arquivo
 * @returns {boolean}
 */
export function versionExists(step, filename) {
  const versionPath = getVersionPath(step, filename);
  return fs.existsSync(versionPath);
}