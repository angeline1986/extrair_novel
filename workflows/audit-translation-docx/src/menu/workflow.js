// src/menu/workflow.js
// Workflow completo (auditar + corrigir + organizar versões)
// ATENÇÃO: Este script NÃO modifica o arquivo original em input/translatedGoogle/
// As versões corrigidas são salvas em input-fixed/v{N}/ e output/fixed/

import fs from 'fs';
import path from 'path';
import { log } from './display.js';
import { runCommand } from './commands.js';
import { askUser } from './utils.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

function logFileCreation(filePath, description) {
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`  📄 [${timestamp}] ${description}: ${path.basename(filePath)} (${sizeKB} KB)`);
  console.log(`     📁 Local: ${filePath}`);
}

export async function runFullWorkflow() {
  const workflowStartTime = new Date();
  
  log('\n🚀 INICIANDO WORKFLOW COMPLETO', 'green');
  console.log('─'.repeat(64));
  console.log(`   ⏱️  Início: ${workflowStartTime.toLocaleString('pt-BR')}`);
  console.log('─'.repeat(64));
  
  const verbose = await askUser('Modo verbose? (S/N): ');
  const isVerbose = verbose === 's' || verbose === 'sim' || verbose === 'y';
  
  const auditCmd = isVerbose 
    ? 'npm run audit:translation:verbose'
    : 'npm run audit:translation';
  
  // ============================================
  // PASSO 1: Auditoria
  // ============================================
  log('\n📋 [PASSO 1] Auditando tradução original...', 'cyan');
  console.log('   📁 Origem: input/translatedGoogle/');
  console.log('   📁 Destino dos relatórios: logs/');
  
  const auditStartTime = new Date();
  if (!runCommand(auditCmd, 'Auditoria')) {
    log('❌ Workflow interrompido na auditoria.', 'red');
    return false;
  }
  const auditEndTime = new Date();
  console.log(`   ⏱️  Auditoria concluída em: ${(auditEndTime - auditStartTime) / 1000} segundos`);
  
  // Listar relatórios gerados
  const logsDir = path.join(projectRoot, 'workflows/audit-translation-docx/logs');
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
  
  // ============================================
  // PASSO 2: Correção de gênero
  // ============================================
  const fix = await askUser('\n🔧 Deseja corrigir problemas de gênero? (s/N): ');
  if (fix !== 's' && fix !== 'sim' && fix !== 'y') {
    log('✨ Workflow concluído (sem correções).', 'green');
    return true;
  }
  
  const fixCmd = isVerbose
    ? 'npm run fix:gender:verbose'
    : 'npm run fix:gender';
  
  log('\n📋 [PASSO 2] Corrigindo problemas de gênero...', 'cyan');
  console.log('   📁 Origem: input/translatedGoogle/');
  console.log('   📁 Destino (backup): output/fixed/step{N}_*/');
  console.log('   📁 Destino (versão): input-fixed/v{N}/');
  
  const fixStartTime = new Date();
  runCommand(fixCmd, 'Correção de gênero');
  const fixEndTime = new Date();
  console.log(`   ⏱️  Correção concluída em: ${(fixEndTime - fixStartTime) / 1000} segundos`);
  
  // ============================================
  // PASSO 3: Organizar versões
  // ============================================
  log('\n📋 [PASSO 3] Organizando versões corrigidas...', 'cyan');
  
  const fixedBaseDir = path.join(projectRoot, 'workflows/audit-translation-docx/output', 'fixed');
  const inputFixedDir = path.join(projectRoot, 'workflows/audit-translation-docx/input-fixed');
  const backupDir = path.join(projectRoot, 'workflows/audit-translation-docx/input', 'backup');
  const translatedFixedDir = path.join(projectRoot, 'workflows/audit-translation-docx/input', 'translated-fixed');
  
  if (!fs.existsSync(inputFixedDir)) {
    fs.mkdirSync(inputFixedDir, { recursive: true });
    console.log(`   📁 Criado diretório: ${inputFixedDir}`);
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`   📁 Criado diretório: ${backupDir}`);
  }
  
  let filesOrganized = 0;
  const organizedFiles = [];
  
  if (fs.existsSync(fixedBaseDir)) {
    const versions = fs.readdirSync(fixedBaseDir)
      .filter(f => fs.statSync(path.join(fixedBaseDir, f)).isDirectory())
      .sort()
      .reverse();
    
    if (versions.length === 0) {
      log('⚠️ Nenhuma versão corrigida encontrada em output/fixed/', 'yellow');
    } else {
      console.log(`\n   📁 Processando ${versions.length} pasta(s) de versão em output/fixed/`);
      
      for (const versionFolder of versions) {
        const latestFixedDir = path.join(fixedBaseDir, versionFolder);
        const fixedFiles = fs.readdirSync(latestFixedDir).filter(f => f.endsWith('_fixed.docx'));
        
        if (fixedFiles.length === 0) continue;
        
        const stepMatch = versionFolder.match(/step(\d+)_/);
        const stepNum = stepMatch ? stepMatch[1] : '1';
        
        console.log(`\n   📂 Versão: ${versionFolder} (Step ${stepNum})`);
        
        for (const fixedFile of fixedFiles) {
          const originalName = fixedFile.replace('_fixed.docx', '.docx');
          const src = path.join(latestFixedDir, fixedFile);
          
          // 1. Salvar em input-fixed/v{N}/
          const versionDest = path.join(inputFixedDir, `v${stepNum}`, originalName);
          if (!fs.existsSync(path.dirname(versionDest))) {
            fs.mkdirSync(path.dirname(versionDest), { recursive: true });
          }
          fs.copyFileSync(src, versionDest);
          filesOrganized++;
          organizedFiles.push({
            step: stepNum,
            source: src,
            destination: versionDest,
            type: 'versão versionada'
          });
          logFileCreation(versionDest, `✅ Versão v${stepNum} criada`);
          
          // 2. Backup adicional com timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
          const backupDest = path.join(backupDir, `${originalName}.v${stepNum}-${timestamp}.backup`);
          fs.copyFileSync(src, backupDest);
          organizedFiles.push({
            step: stepNum,
            source: src,
            destination: backupDest,
            type: 'backup'
          });
          console.log(`     📋 Backup: ${path.basename(backupDest)}`);
          
          // 3. Opcional: salvar em translated-fixed/ (última versão)
          if (!fs.existsSync(translatedFixedDir)) {
            fs.mkdirSync(translatedFixedDir, { recursive: true });
          }
          const finalDest = path.join(translatedFixedDir, originalName);
          fs.copyFileSync(src, finalDest);
          organizedFiles.push({
            step: stepNum,
            source: src,
            destination: finalDest,
            type: 'última versão'
          });
          console.log(`     📁 Última versão: ${finalDest}`);
        }
      }
      
      log(`\n✅ ${filesOrganized} arquivo(s) organizado(s) com sucesso!`, 'green');
      console.log(`\n   📊 RESUMO DOS ARQUIVOS CRIADOS:`);
      console.log(`   ───────────────────────────────────────────────`);
      
      // Agrupar por tipo
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
      console.log(`   📁 Original preservado: ${path.join(projectRoot, 'workflows/audit-translation-docx/input/translatedGoogle')}`);
    }
  } else {
    log('⚠️ Pasta output/fixed/ não encontrada.', 'yellow');
  }
  
  // ============================================
  // PASSO 4: Re-auditoria opcional
  // ============================================
  const reaudit = await askUser('\n🔄 Deseja re-auditar o arquivo ORIGINAL? (s/N): ');
  if (reaudit === 's' || reaudit === 'sim' || reaudit === 'y') {
    log('\n📋 [PASSO 4] Re-auditando o original...', 'cyan');
    runCommand(auditCmd, 'Re-auditoria do original');
  } else {
    log('\n💡 Para auditar a versão corrigida:', 'cyan');
    console.log('   1. npm run version:status');
    console.log('   2. npm run version:goto -- 1');
    console.log('   3. npm run audit:translation');
  }
  
  // ============================================
  // RESUMO FINAL
  // ============================================
  const workflowEndTime = new Date();
  const duration = (workflowEndTime - workflowStartTime) / 1000;
  
  log('\n✅ WORKFLOW CONCLUÍDO!', 'green');
  console.log('─'.repeat(64));
  console.log(`   ⏱️  Duração total: ${duration} segundos`);
  console.log(`   ⏱️  Término: ${workflowEndTime.toLocaleString('pt-BR')}`);
  console.log('─'.repeat(64));
  
  log('\n📝 RESUMO DOS ARQUIVOS:', 'cyan');
  console.log(`   📁 Original preservado: input/translatedGoogle/ (NÃO MODIFICADO)`, 'green');
  console.log(`   📁 Versões corrigidas: input-fixed/v1/, v2/, v3/...`, 'cyan');
  console.log(`   📁 Backups: output/fixed/step{N}_*/`, 'cyan');
  console.log(`   📁 Backups adicionais: input/backup/`, 'cyan');
  console.log(`   📁 Última versão: input/translated-fixed/`, 'cyan');
  console.log(`   📁 Relatórios: logs/`, 'cyan');
  
  return true;
}