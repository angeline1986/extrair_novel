// src/menu/steps/step2FixGender.js
// PASSO 2: Normalização de entidades + correção de problemas de gênero

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { getNextVersion, getWorkingInput } from '../../version/versionWorkflow.js';

export async function step2FixGender(isVerbose) {
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const workingInput = getWorkingInput({ resetWorkingCopy });
  const nextVersion = getNextVersion();
  const fixCmd = isVerbose
    ? `npm run --silent fix:gender:verbose${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`
    : `npm run --silent fix:gender${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`;
  
  log('\n📋 [PASSO 2] Normalizando entidades e corrigindo problemas de gênero...', 'cyan');
  console.log(`   📁 Próxima versão: v${nextVersion}`);
  console.log(`   📁 Origem da correção: ${workingInput.relativePath}`);
  console.log(`   📁 Pré-normalização: output/normalized/v${nextVersion}/`);
  console.log(`   📁 Destino (backup): output/fixed/v${nextVersion}/`);
  console.log(`   📁 Destino (versão): input-fixed/v${nextVersion}/`);
  
  const fixStartTime = new Date();
  const success = runCommand(fixCmd, 'Normalização e correção', { env: { AUDIT_CONCISE: '1' } });
  const fixEndTime = new Date();
  console.log(`   ⏱️  Normalização/correção concluída em: ${(fixEndTime - fixStartTime) / 1000} segundos`);
  
  return success;
}
