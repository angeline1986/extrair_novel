// src/menu/steps/step3Organize.js
// PASSO 3: Organizar versões corrigidas e salvar em output/auditada/

import fs from 'fs';
import path from 'path';
import { log } from '../display.js';
import { 
  logFileCreation, 
  ensureDirectory,
  getInputFixedDir,
  getAuditadaDir
} from './stepUtils.js';
import { logWorkflowEvent } from '../../observability/workflowLog.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export async function step3Organize() {
  log('\n📋 [PASSO 3] Organizando versões corrigidas...', 'cyan');
  
  const inputFixedDir = getInputFixedDir();
  const auditadaDir = getAuditadaDir();
  const outputBackupDir = path.join(projectRoot, 'workflows/audit-translation-docx/output', 'fixed');
  
  ensureDirectory(inputFixedDir);
  ensureDirectory(auditadaDir);
  
  // Verificar versões existentes
  const existingVersions = [];
  for (let i = 1; i <= 10; i++) {
    const vPath = path.join(inputFixedDir, `v${i}`);
    if (fs.existsSync(vPath)) existingVersions.push(`v${i}`);
  }

  let filesOrganized = 0;
  const organizedFiles = [];
  
  if (fs.existsSync(outputBackupDir)) {
    const versions = fs.readdirSync(outputBackupDir)
      .filter(f => fs.statSync(path.join(outputBackupDir, f)).isDirectory())
      .sort()
      .reverse();
    
    if (versions.length === 0) {
      log('⚠️ Nenhuma versão corrigida encontrada em output/fixed/', 'yellow');
    } else {
      console.log(`\n   📁 Processando ${versions.length} pasta(s) de versão em output/fixed/`);
      
      for (const versionFolder of versions) {
        const latestFixedDir = path.join(outputBackupDir, versionFolder);
        const fixedFiles = fs.readdirSync(latestFixedDir).filter(f => f.endsWith('_fixed.docx'));
        
        if (fixedFiles.length === 0) continue;
        
        const stepMatch = versionFolder.match(/step(\d+)_/);
        const stepNum = stepMatch ? stepMatch[1] : '1';
        
        logWorkflowEvent('STEP_STARTED', {
          step: 3,
          name: 'Organizar versões',
          expectedFiles: fixedFiles.map(f => f),
          foundFiles: fixedFiles.length
        });
        
        console.log(`\n   📂 Versão: ${versionFolder} (Step ${stepNum})`);
        
        for (const fixedFile of fixedFiles) {
          const originalName = fixedFile.replace('_fixed.docx', '.docx');
          const src = path.join(latestFixedDir, fixedFile);
          
          logWorkflowEvent('VERSION_DECISION', {
            step: stepNum,
            file: originalName,
            details: {
              currentStep: parseInt(stepNum),
              targetVersion: `v${stepNum}`,
              previousVersionsFound: existingVersions.filter(v => parseInt(v.substring(1)) < parseInt(stepNum)),
              expectedPreviousVersions: Array.from({length: parseInt(stepNum)-1}, (_, i) => `v${i+1}`),
              missingPreviousVersions: Array.from({length: parseInt(stepNum)-1}, (_, i) => `v${i+1}`).filter(v => !existingVersions.includes(v)),
              reason: `creating version for active step ${stepNum}`
            }
          });
          
          // 1. Salvar em input-fixed/v{N}/ (versão versionada)
          const versionDest = path.join(inputFixedDir, `v${stepNum}`, originalName);
          ensureDirectory(path.dirname(versionDest));
          
          logWorkflowEvent('FILE_WRITE', {
            step: stepNum,
            file: originalName,
            action: 'copy',
            source: src,
            destination: versionDest,
            sizeBytes: fs.statSync(src).size,
            overwrite: fs.existsSync(versionDest)
          });
          
          fs.copyFileSync(src, versionDest);
          filesOrganized++;
          organizedFiles.push({
            step: stepNum,
            source: src,
            destination: versionDest,
            type: 'versão versionada'
          });
          logFileCreation(versionDest, `✅ Versão v${stepNum} criada`);
          
          // 2. Salvar em output/auditada/ (versão final auditada)
          const auditadaDest = path.join(auditadaDir, originalName);
          fs.copyFileSync(src, auditadaDest);
          organizedFiles.push({
            step: stepNum,
            source: src,
            destination: auditadaDest,
            type: 'versão final auditada'
          });
          console.log(`     📁 Versão final auditada: ${auditadaDest}`);
          
          // 3. Atualizar current/ (última versão)
          const currentDir = path.join(inputFixedDir, 'current');
          ensureDirectory(currentDir);
          const currentDest = path.join(currentDir, originalName);
          fs.copyFileSync(src, currentDest);
          console.log(`     📁 Última versão (current): ${currentDest}`);
        }
      }
      
      const finalVersions = [];
      for (let i = 1; i <= 10; i++) {
        const vPath = path.join(inputFixedDir, `v${i}`);
        if (fs.existsSync(vPath)) finalVersions.push(`v${i}`);
      }
      const allExpected = Array.from({length: Math.max(...finalVersions.map(v => parseInt(v.substring(1))), 0)}, (_, i) => `v${i+1}`);
      const missing = allExpected.filter(v => !finalVersions.includes(v));
      
      if (missing.length > 0) {
        logWorkflowEvent('VERSION_MISSING_GAP', {
          severity: 'WARN',
          details: {
            existingVersions: finalVersions,
            missingVersions: missing,
            explanation: finalVersions.length === 1 && finalVersions[0] === 'v3'
              ? 'workflow started at step 3 (likely .current-step was 3)'
              : 'version sequence has gaps; previous versions may have been deleted or never created'
          }
        });
      }
      
      log(`\n✅ ${filesOrganized} arquivo(s) organizado(s) com sucesso!`, 'green');
      console.log(`\n   📊 RESUMO DOS ARQUIVOS CRIADOS:`);
      console.log(`   ───────────────────────────────────────────────`);
      
      const byType = {};
      for (const item of organizedFiles) {
        if (!byType[item.type]) byType[item.type] = [];
        byType[item.type].push(item);
      }
      
      for (const [type, items] of Object.entries(byType)) {
        console.log(`\n   📁 ${type.toUpperCase()} (${items.length} arquivo(s)):`);
        for (const item of items) {
          console.log(`      📄 Step ${item.step}: ${path.basename(item.destination)}`);
          console.log(`         → ${item.destination}`);
        }
      }
      
      console.log(`\n   ⚠️  O original em input/translatedGoogle/ NÃO foi modificado.`);
      console.log(`   📁 Versão final auditada disponível em: ${auditadaDir}/`);
    }
  } else {
    log('⚠️ Pasta output/fixed/ não encontrada.', 'yellow');
  }
  
  return { filesOrganized };
}