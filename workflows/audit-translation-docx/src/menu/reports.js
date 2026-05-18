// src/menu/reports.js
// Visualização de relatórios

import fs from 'fs';
import path from 'path';
import { log } from './display.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export function showLastReport() {
  const logsDir = path.join(projectRoot, 'workflows/audit-translation-docx/logs');
  
  if (!fs.existsSync(logsDir)) {
    log('⚠️ Nenhum relatório encontrado.', 'yellow');
    return;
  }
  
  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('audit-summary-') && f.endsWith('.txt'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    log('⚠️ Nenhum relatório encontrado.', 'yellow');
    return;
  }
  
  const latest = files[0];
  const reportPath = path.join(logsDir, latest);
  const content = fs.readFileSync(reportPath, 'utf8');
  
  log(`\n📄 Último relatório: ${latest}`, 'cyan');
  console.log('─'.repeat(64));
  console.log(content);
}