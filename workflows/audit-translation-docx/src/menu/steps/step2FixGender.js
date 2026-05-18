// src/menu/steps/step2FixGender.js
// PASSO 2: Correção de problemas de gênero

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { getNextVersion, getWorkingInput } from '../../version/versionWorkflow.js';

export async function step2FixGender(isVerbose) {
  const resetWorkingCopy = process.argv.includes('--reset-working-copy');
  const workingInput = getWorkingInput({ resetWorkingCopy });
  const nextVersion = getNextVersion();
  const fixCmd = isVerbose
    ? `npm run fix:gender:verbose${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`
    : `npm run fix:gender${resetWorkingCopy ? ' -- --reset-working-copy' : ''}`;
  
  log('\n📋 [PASSO 2] Corrigindo problemas de gênero...', 'cyan');
  console.log(`   📁 Próxima versão: v${nextVersion}`);
  console.log(`   📁 Origem da correção: ${workingInput.relativePath}`);
  console.log('   📁 Pré-normalização: output/normalized/step{N}_*/');
  console.log('   📁 Destino (backup): output/fixed/step{N}_*/');
  console.log(`   📁 Destino (versão): input-fixed/v${nextVersion}/`);
  
  const fixStartTime = new Date();
  runCommand(fixCmd, 'Correção de gênero');
  const fixEndTime = new Date();
  console.log(`   ⏱️  Correção concluída em: ${(fixEndTime - fixStartTime) / 1000} segundos`);
  
  return true;
}
