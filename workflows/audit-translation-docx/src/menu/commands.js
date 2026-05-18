// src/menu/commands.js
// Execução de comandos

import { execSync } from 'child_process';
import { log } from './display.js';

const projectRoot = '/Users/alinesouza/Documents/TI/Projetos/Extrair_novel';

export function runCommand(command, description) {
  log(`\n▶ ${description}`, 'cyan');
  console.log('─'.repeat(64));
  
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: 'true' }
    });
    return true;
  } catch (error) {
    if (command.includes('audit')) {
      log(`\n⚠️ Auditoria concluída (problemas detectados são normais)`, 'yellow');
      return true;
    }
    log(`\n❌ Comando falhou: ${description}`, 'red');
    return false;
  }
}