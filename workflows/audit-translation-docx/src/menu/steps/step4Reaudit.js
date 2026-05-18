// src/menu/steps/step4Reaudit.js
// PASSO 4: Re-auditoria opcional

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { askUser } from '../utils.js';
import {
  getVersionInput,
  getWorkingInput,
  logReauditTarget,
} from '../../version/versionWorkflow.js';

export async function step4Reaudit(isVerbose) {
  console.log('\n🔄 Re-auditar qual versão?');
  console.log('   1. Working version atual (recomendado)');
  console.log('   2. Original Google');
  console.log('   3. Versão específica');

  const choice = await askUser('Escolha [1]: ');
  const selected = choice.trim() || '1';
  let auditCmd;
  let target;
  let description;

  if (selected === '2') {
    target = getWorkingInput({ resetWorkingCopy: true }).path;
    auditCmd = isVerbose
      ? 'npm run audit:translation:verbose -- --reset-working-copy'
      : 'npm run audit:translation -- --reset-working-copy';
    description = 'Re-auditoria do original Google';
  } else if (selected === '3') {
    const version = await askUser('Informe a versão (ex: 2 para v2): ');
    target = getVersionInput(Number(version));
    auditCmd = isVerbose
      ? `npm run audit:translation:verbose -- --working-input=${target}`
      : `npm run audit:translation -- --working-input=${target}`;
    description = `Re-auditoria da v${version}`;
  } else {
    target = getWorkingInput().path;
    auditCmd = isVerbose
      ? 'npm run audit:translation:verbose'
      : 'npm run audit:translation';
    description = 'Re-auditoria da working version atual';
  }

  logReauditTarget(target);
  log(`\n📋 [PASSO 4] ${description}...`, 'cyan');
  runCommand(auditCmd, description);
}
