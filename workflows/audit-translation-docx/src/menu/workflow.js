// src/menu/workflow.js
// Workflow completo (auditar + corrigir + aplicar)

import fs from 'fs';
import path from 'path';
import { log } from './display.js';
import { runCommand } from './commands.js';
import { askUser } from './utils.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export async function runFullWorkflow() {
  log('\n🚀 INICIANDO WORKFLOW COMPLETO', 'green');
  console.log('─'.repeat(64));
  
  const verbose = await askUser('Modo verbose? (S/N): ');
  const isVerbose = verbose === 's' || verbose === 'sim' || verbose === 'y';
  
  const auditCmd = isVerbose 
    ? 'npm run audit:translation:verbose'
    : 'npm run audit:translation';
  
  log('\n📋 PASSO 1: Auditando...', 'cyan');
  if (!runCommand(auditCmd, 'Auditoria')) {
    log('❌ Workflow interrompido na auditoria.', 'red');
    return false;
  }
  
  const fix = await askUser('\n🔧 Deseja corrigir problemas de gênero? (s/N): ');
  if (fix !== 's' && fix !== 'sim' && fix !== 'y') {
    log('✨ Workflow concluído (sem correções).', 'green');
    return true;
  }
  
  const fixCmd = isVerbose
    ? 'npm run fix:gender:verbose'
    : 'npm run fix:gender';
  
  log('\n🔧 PASSO 2: Corrigindo problemas de gênero...', 'cyan');
  runCommand(fixCmd, 'Correção de gênero');
  
  // PASSO 3: Aplicar correções automaticamente
  log('\n📋 PASSO 3: Aplicando correções automaticamente...', 'cyan');
  
  const fixedBaseDir = path.join(projectRoot, 'workflows/audit-translation-docx/output', 'fixed');
  const translatedDir = path.join(projectRoot, 'workflows/audit-translation-docx/input', 'translated');
  const translatedFixedDir = path.join(projectRoot, 'workflows/audit-translation-docx/input', 'translated-fixed');
  const backupDir = path.join(projectRoot, 'workflows/audit-translation-docx/input', 'backup');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  if (!fs.existsSync(translatedFixedDir)) {
    fs.mkdirSync(translatedFixedDir, { recursive: true });
  }
  
  if (fs.existsSync(fixedBaseDir)) {
    const versions = fs.readdirSync(fixedBaseDir)
      .filter(f => fs.statSync(path.join(fixedBaseDir, f)).isDirectory())
      .sort()
      .reverse();
    
    if (versions.length > 0) {
      const latestVersion = versions[0];
      const latestFixedDir = path.join(fixedBaseDir, latestVersion);
      const fixedFiles = fs.readdirSync(latestFixedDir).filter(f => f.endsWith('_fixed.docx'));
      
      for (const fixedFile of fixedFiles) {
        const originalName = fixedFile.replace('_fixed.docx', '.docx');
        const src = path.join(latestFixedDir, fixedFile);
        const dest = path.join(translatedDir, originalName);
        const fixedDest = path.join(translatedFixedDir, originalName);
        const backupPath = path.join(backupDir, `${originalName}.${latestVersion}.backup`);
        
        // Backup do original (se não existir backup desta versão)
        if (fs.existsSync(dest) && !fs.existsSync(backupPath)) {
          fs.copyFileSync(dest, backupPath);
          console.log(`  📋 Backup: ${originalName} → ${backupPath}`);
        }
        
        // Copiar para translated/ (sobrescreve original)
        fs.copyFileSync(src, dest);
        console.log(`  ✅ Aplicado em translated/: ${originalName} (versão ${latestVersion})`);
        
        // Copiar para translated-fixed/ (versão final sem sufixo)
        fs.copyFileSync(src, fixedDest);
        console.log(`  📁 Versão final em translated-fixed/: ${originalName}`);
      }
      
      log(`\n✅ Arquivos corrigidos aplicados!`, 'green');
      log(`   📁 Original (backup): ${backupDir}`, 'cyan');
      log(`   📁 Tradução corrigida: ${translatedDir}`, 'green');
      log(`   📁 Versão final (preservada): ${translatedFixedDir}`, 'cyan');
    } else {
      log(`⚠️ Nenhuma versão corrigida encontrada.`, 'yellow');
    }
  } else {
    log(`⚠️ Pasta de versões corrigidas não encontrada.`, 'yellow');
  }
  
  const reaudit = await askUser('\n🔄 Deseja re-auditar após as correções? (s/N): ');
  if (reaudit === 's' || reaudit === 'sim' || reaudit === 'y') {
    log('\n📋 PASSO 4: Re-auditando...', 'cyan');
    runCommand(auditCmd, 'Re-auditoria');
  }
  
  log('\n✅ WORKFLOW CONCLUÍDO!', 'green');
  log('\n📝 RESUMO DOS ARQUIVOS:', 'cyan');
  log('   📁 Original (backup): input/backup/', 'white');
  log('   📁 Tradução atual: input/translated/ (substituída pela corrigida)', 'green');
  log('   📁 Versão final preservada: input/translated-fixed/', 'cyan');
  log('   📁 Versões históricas: output/fixed/{timestamp}/', 'white');
  
  return true;
}