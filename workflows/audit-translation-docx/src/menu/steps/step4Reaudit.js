// src/menu/steps/step4Reaudit.js
// PASSO 4: Re-auditoria opcional

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { askUser } from '../utils.js';
import {
  getVersionInput,
  getVersionWorkflowInfo,
  getWorkingInput,
  logReauditTarget,
} from '../../version/versionWorkflow.js';

export async function step4Reaudit(isVerbose) {
  const workflowInfo = getVersionWorkflowInfo();
  const currentLabel = workflowInfo.currentVersion
    ? `v${workflowInfo.currentVersion} (input-fixed/current)`
    : 'input/translatedGoogle';
  const shouldReauditCurrent = await askUser(
    `\n🔄 Re-auditar a versão recém-gerada/atual (${currentLabel})? (S/n): `
  );
  const selectedCurrent = !['n', 'nao', 'não', 'no'].includes(shouldReauditCurrent.trim());
  let auditCmd;
  let target;
  let description;

  if (selectedCurrent) {
    target = getWorkingInput().path;
    auditCmd = isVerbose
      ? 'npm run audit:translation:verbose'
      : 'npm run audit:translation';
    description = `Re-auditoria da versão atual ${currentLabel}`;
  } else {
    console.log('\nOpções avançadas de re-auditoria:');
    console.log('   1. Original Google');
    console.log('   2. Versão específica');
    console.log('   Enter. Pular re-auditoria');

    const choice = await askUser('Escolha [Enter]: ');
    const selected = choice.trim();

    if (!selected) {
      log('\n⏭️ Re-auditoria pulada.', 'yellow');
      return;
    }

    if (selected === '1') {
      target = getWorkingInput({ resetWorkingCopy: true }).path;
      auditCmd = isVerbose
        ? 'npm run audit:translation:verbose -- --reset-working-copy'
        : 'npm run audit:translation -- --reset-working-copy';
      description = 'Re-auditoria do original Google';
    } else if (selected === '2') {
      const version = await askUser('Informe a versão (ex: 2 para v2): ');
      target = getVersionInput(Number(version));
      auditCmd = isVerbose
        ? `npm run audit:translation:verbose -- --working-input=${target}`
        : `npm run audit:translation -- --working-input=${target}`;
      description = `Re-auditoria da v${version}`;
    } else {
      log('\n⏭️ Opção inválida. Re-auditoria pulada.', 'yellow');
      return;
    }
  }

  logReauditTarget(target);
  log(`\n📋 [PASSO 4] ${description}...`, 'cyan');
  runCommand(auditCmd, description);
}
