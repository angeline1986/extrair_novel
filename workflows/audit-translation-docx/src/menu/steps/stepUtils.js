// src/menu/steps/stepUtils.js
// Utilitários para os steps do workflow

import fs from 'fs';
import path from 'path';
import { logWorkflowEvent } from '../../observability/workflowLog.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export function logFileCreation(filePath, description) {
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`  📄 [${timestamp}] ${description}: ${path.basename(filePath)} (${sizeKB} KB)`);
  console.log(`     📁 Local: ${filePath}`);
  
  logWorkflowEvent('FILE_WRITE', {
    step: 'unknown',
    file: path.basename(filePath),
    action: 'create',
    destination: filePath,
    sizeBytes: stats.size,
    description
  });
}

export function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`   📁 Criado diretório: ${dirPath}`);
  }
}

export function getLogsDir() {
  return path.join(projectRoot, 'workflows/audit-translation-docx/logs');
}

export function getInputFixedDir() {
  return path.join(projectRoot, 'workflows/audit-translation-docx/input-fixed');
}
