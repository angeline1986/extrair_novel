// src/menu/steps/step4Reaudit.js
// PASSO 4: Re-auditoria opcional

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { askUser } from '../utils.js';

export async function step4Reaudit(isVerbose) {
  const auditCmd = isVerbose 
    ? 'npm run audit:translation:verbose'
    : 'npm run audit:translation';
  
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
}