// src/menu/steps/step4Reaudit.js
// PASSO 3: Re-auditoria da versão publicada

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import {
  getVersionWorkflowInfo,
  getWorkingInput,
  logReauditTarget,
} from '../../version/versionWorkflow.js';

export async function step4Reaudit(isVerbose) {
  const workflowInfo = getVersionWorkflowInfo();
  const currentLabel = workflowInfo.currentVersion
    ? `v${workflowInfo.currentVersion} (input-fixed/current)`
    : 'input/translatedGoogle';
  const target = getWorkingInput().path;
  const auditCmd = isVerbose
    ? 'npm run --silent audit:translation:verbose'
    : 'npm run --silent audit:translation';
  const description = `Re-auditoria da versão publicada ${currentLabel}`;

  logReauditTarget(target);
  log(`\n📋 [PASSO 3] ${description}...`, 'cyan');
  return runCommand(auditCmd, description, { env: { AUDIT_CONCISE: '1' } });
}
