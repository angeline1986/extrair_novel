// src/menu/menuOrchestrator.js
// Orquestrador principal do menu interativo

import { clearScreen, showHeader, showMenu, log } from './display.js';
import { runCommand } from './commands.js';
import { showLastReport } from './reports.js';
import { cleanOldReports } from './cleanup.js';
import { runFullWorkflow } from './workflow.js';
import { askUser } from './utils.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

/**
 * Executar comando de versionamento e aguardar
 */
async function runVersionCommand(command, description, args = '') {
  const fullCommand = `npm run version:${command}${args ? ` -- ${args}` : ''}`;
  runCommand(fullCommand, description);
  console.log();
  await askUser('Pressione ENTER para continuar...');
}

/**
 * Restaurar versão específica (interativo)
 */
async function restoreSpecificVersion() {
  console.log();
  log('📋 VERSÕES DISPONÍVEIS:', 'cyan');
  
  // Executar version:list para mostrar as versões
  runCommand('npm run version:list', 'Listando versões');
  
  console.log();
  const step = await askUser('Digite o número do step para restaurar (ex: 2): ');
  
  if (step && !isNaN(parseInt(step))) {
    const stepNum = parseInt(step);
    console.log();
    const confirm = await askUser(`⚠️ Tem certeza que deseja restaurar a versão v${stepNum}? (s/N): `);
    if (confirm === 's' || confirm === 'sim' || confirm === 'y') {
      await runVersionCommand('goto', `Restaurando step ${stepNum}`, stepNum);
      log(`\n✅ Versão v${stepNum} restaurada!`, 'green');
      log('   Execute "npm run audit:translation" para validar.', 'cyan');
    } else {
      log('✨ Operação cancelada.', 'yellow');
    }
  } else {
    log('❌ Step inválido. Operação cancelada.', 'red');
  }
}

/**
 * Função principal do orquestrador
 */
export async function main() {
  while (true) {
    clearScreen();
    showHeader();
    showMenu();
    
    const choice = await askUser('👉 Digite o número da opção: ');
    
    switch (choice) {
      // ========== AUDITORIA ==========
      case '1':
        runCommand('npm run audit:translation', 'Auditoria normal');
        break;
      case '2':
        runCommand('npm run audit:translation:verbose', 'Auditoria com detalhes');
        break;
      
      // ========== CORREÇÃO ==========
      case '3':
        runCommand('npm run fix:gender', 'Correção de gênero');
        break;
      case '4':
        runCommand('npm run fix:gender:verbose', 'Correção de gênero (verbose)');
        break;
      
      // ========== WORKFLOW ==========
      case '5':
        await runFullWorkflow();
        break;
      
      // ========== RELATÓRIOS ==========
      case '6':
        showLastReport();
        break;
      case '7':
        await cleanOldReports();
        break;
      
      // ========== VERSIONAMENTO ==========
      case '8':
        await runVersionCommand('status', 'Status das versões');
        break;
      case '9':
        const confirmNext = await askUser('⚠️ Tem certeza que deseja avançar para o próximo step? (s/N): ');
        if (confirmNext === 's' || confirmNext === 'sim' || confirmNext === 'y') {
          await runVersionCommand('next', 'Avançando step');
          log('\n✨ Novo step criado! Execute "npm run fix:gender" para corrigir a nova versão.', 'green');
        } else {
          log('✨ Operação cancelada.', 'yellow');
          await askUser('Pressione ENTER para continuar...');
        }
        break;
      case '10':
        const confirmPrev = await askUser('⚠️ Tem certeza que deseja voltar para o step anterior? (s/N): ');
        if (confirmPrev === 's' || confirmPrev === 'sim' || confirmPrev === 'y') {
          await runVersionCommand('prev', 'Voltando step');
          log('\n✨ Step anterior restaurado! Execute "npm run audit:translation" para validar.', 'green');
        } else {
          log('✨ Operação cancelada.', 'yellow');
          await askUser('Pressione ENTER para continuar...');
        }
        break;
      case '11':
        await restoreSpecificVersion();
        break;
      
      // ========== SAIR ==========
      case '12':
        log('\n✨ Até logo!\n', 'magenta');
        return;
      
      // ========== DEFAULT ==========
      default:
        log('\n❌ Opção inválida. Tente novamente.', 'red');
    }
    
    if (choice !== '12') {
      console.log();
      console.log('─'.repeat(64));
      await askUser('\nPressione ENTER para continuar...');
    }
  }
}