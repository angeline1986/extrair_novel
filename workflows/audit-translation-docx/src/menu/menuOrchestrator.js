// src/menu/menuOrchestrator.js
// Orquestrador principal do menu

import { clearScreen, showHeader, showMenu, log } from './display.js';
import { runCommand } from './commands.js';
import { showLastReport } from './reports.js';
import { cleanOldReports } from './cleanup.js';
import { runFullWorkflow } from './workflow.js';
import { askUser } from './utils.js';

export async function main() {
  while (true) {
    clearScreen();
    showHeader();
    showMenu();
    
    const choice = await askUser('👉 Digite o número da opção: ');
    
    switch (choice) {
      case '1':
        runCommand('npm run audit:translation', 'Auditoria normal');
        break;
      case '2':
        runCommand('npm run audit:translation:verbose', 'Auditoria com detalhes');
        break;
      case '3':
        runCommand('npm run fix:gender', 'Correção de gênero');
        break;
      case '4':
        runCommand('npm run fix:gender:verbose', 'Correção de gênero (verbose)');
        break;
      case '5':
        await runFullWorkflow();
        break;
      case '6':
        showLastReport();
        break;
      case '7':
        await cleanOldReports();
        break;
      case '8':
        log('\n✨ Até logo!\n', 'magenta');
        return;
      default:
        log('\n❌ Opção inválida. Tente novamente.', 'red');
    }
    
    if (choice !== '8') {
      console.log();
      console.log('─'.repeat(64));
      await askUser('\nPressione ENTER para continuar...');
    }
  }
}