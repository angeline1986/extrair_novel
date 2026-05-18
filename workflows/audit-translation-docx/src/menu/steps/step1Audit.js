// src/menu/steps/step1Audit.js
// PASSO 1: Auditoria da tradução original

import fs from 'fs';
import path from 'path';
import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { getLogsDir } from './stepUtils.js';
import { getWorkingInput } from '../../version/versionWorkflow.js';

export async function step1Audit(isVerbose) {
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const workingInput = getWorkingInput({ resetWorkingCopy });
  const auditCmd = isVerbose 
    ? `npm run audit:translation:verbose${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`
    : `npm run audit:translation${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`;
  
  log('\n📋 [PASSO 1] Auditando working source...', 'cyan');
  console.log(`   📁 Origem: ${workingInput.relativePath}`);
  console.log('   📁 Destino dos relatórios: logs/');
  
  const auditStartTime = new Date();
  if (!runCommand(auditCmd, 'Auditoria')) {
    log('❌ Workflow interrompido na auditoria.', 'red');
    return false;
  }
  const auditEndTime = new Date();
  console.log(`   ⏱️  Auditoria concluída em: ${(auditEndTime - auditStartTime) / 1000} segundos`);
  
  // Listar relatórios gerados
  const logsDir = getLogsDir();
  if (fs.existsSync(logsDir)) {
    const reportFiles = fs.readdirSync(logsDir)
      .filter(f => f.includes('audit-report') || f.includes('audit-summary') || f.includes('issues'))
      .sort()
      .reverse()
      .slice(0, 3);
    
    if (reportFiles.length > 0) {
      console.log('\n   📊 Relatórios gerados:');
      for (const file of reportFiles) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`      📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    }
  }
  
  return true;
}
