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
  
  const htmlFiles = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('audit-dashboard-') && f.endsWith('.html'))
    .sort()
    .reverse();
  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('audit-summary-') && f.endsWith('.txt'))
    .sort()
    .reverse();
  
  if (files.length === 0 && htmlFiles.length === 0) {
    log('⚠️ Nenhum relatório encontrado.', 'yellow');
    return;
  }

  if (htmlFiles.length > 0) {
    const latestHtml = htmlFiles.find((file) => file !== 'audit-dashboard-latest.html') || htmlFiles[0];
    log(`\n🧭 Dashboard HTML: ${path.join(logsDir, latestHtml)}`, 'cyan');
    log(`   Atalho estável: ${path.join(logsDir, 'audit-dashboard-latest.html')}`, 'cyan');
  }

  if (files.length === 0) return;
  
  const latest = files[0];
  const reportPath = path.join(logsDir, latest);
  const content = fs.readFileSync(reportPath, 'utf8');
  
  log(`\n📄 Último relatório: ${latest}`, 'cyan');
  console.log('─'.repeat(64));
  console.log(content);
}
