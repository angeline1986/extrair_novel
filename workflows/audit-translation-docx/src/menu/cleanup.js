// src/menu/cleanup.js
// Limpeza de relatórios antigos

import fs from 'fs';
import path from 'path';
import { log } from './display.js';
import { askUser } from './utils.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export async function cleanOldReports() {
  const logsDir = path.join(projectRoot, 'workflows/audit-translation-docx/logs');
  
  if (!fs.existsSync(logsDir)) {
    log('⚠️ Pasta de logs não encontrada.', 'yellow');
    return;
  }
  
  const files = fs.readdirSync(logsDir);
  
  const reportFiles = files.filter(f => {
    return f.match(/\.(json|csv|txt)$/) && 
           (f.includes('audit-') || f.includes('issues-') || 
            f.includes('problematic-') || f.includes('correcoes_') ||
            f.includes('audit-summary'));
  });
  
  if (reportFiles.length === 0) {
    log('ℹ️ Nenhum relatório encontrado para limpar.', 'yellow');
    return;
  }
  
  console.log();
  log(`📊 Encontrados ${reportFiles.length} relatórios na pasta logs/`, 'cyan');
  console.log();
  
  for (const file of reportFiles.slice(0, 10)) {
    const stats = fs.statSync(path.join(logsDir, file));
    const size = (stats.size / 1024).toFixed(1);
    console.log(`   📄 ${file} (${size} KB)`);
  }
  if (reportFiles.length > 10) {
    console.log(`   ... e mais ${reportFiles.length - 10} arquivos`);
  }
  
  console.log();
  log('❓ O que deseja fazer?', 'yellow');
  console.log();
  log('  1. 🗑️  Limpar TODOS os relatórios', 'red');
  log('  2. 📌 Manter apenas os 5 mais recentes', 'cyan');
  log('  3. ❌ Cancelar', 'white');
  console.log();
  
  const option = await askUser('👉 Escolha uma opção (1/2/3): ');
  
  if (option === '3') {
    log('✨ Operação cancelada.', 'yellow');
    return;
  }
  
  let toDelete = [];
  
  if (option === '1') {
    toDelete = reportFiles;
    log(`\n⚠️ ATENÇÃO: Você está prestes a remover TODOS os ${toDelete.length} relatórios!`, 'red');
  } else if (option === '2') {
    const sortedFiles = [...reportFiles].sort((a, b) => {
      const statA = fs.statSync(path.join(logsDir, a));
      const statB = fs.statSync(path.join(logsDir, b));
      return statB.mtimeMs - statA.mtimeMs;
    });
    toDelete = sortedFiles.slice(5);
    
    if (toDelete.length === 0) {
      log(`\n✅ Nenhum relatório para remover. Já mantém apenas os 5 mais recentes.`, 'green');
      return;
    }
    
    console.log();
    log(`🗑️ Os seguintes ${toDelete.length} arquivo(s) antigos serão removidos:`, 'yellow');
    for (const file of toDelete) {
      console.log(`   - ${file}`);
    }
  } else {
    log('\n❌ Opção inválida. Operação cancelada.', 'red');
    return;
  }
  
  console.log();
  const confirm = await askUser('Tem certeza? (s/N): ');
  
  if (confirm !== 's' && confirm !== 'sim' && confirm !== 'y') {
    log('✨ Operação cancelada.', 'yellow');
    return;
  }
  
  let deleted = 0;
  for (const file of toDelete) {
    const filePath = path.join(logsDir, file);
    fs.unlinkSync(filePath);
    deleted++;
    console.log(`  🗑️ Removido: ${file}`);
  }
  
  if (option === '1') {
    log(`\n✅ ${deleted} relatório(s) removido(s). A pasta logs/ está vazia.`, 'green');
  } else {
    log(`\n✅ ${deleted} arquivo(s) removido(s). Mantidos os 5 relatórios mais recentes.`, 'green');
  }
}