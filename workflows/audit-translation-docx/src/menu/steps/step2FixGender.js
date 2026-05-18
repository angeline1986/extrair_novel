// src/menu/steps/step2FixGender.js
// PASSO 2: Correção de problemas de gênero

import { log } from '../display.js';
import { runCommand } from '../commands.js';
import { getCurrentStep } from '../../version/versionCore.js';

export async function step2FixGender(isVerbose) {
  const currentStep = getCurrentStep();
  const sourceDir = currentStep > 1 ? `input-fixed/v${currentStep - 1}/` : 'input/translatedGoogle/';
  const fixCmd = isVerbose
    ? `npm run fix:gender:verbose -- --step=${currentStep}`
    : `npm run fix:gender -- --step=${currentStep}`;
  
  log('\n📋 [PASSO 2] Corrigindo problemas de gênero...', 'cyan');
  console.log(`   📁 Step atual: ${currentStep}`);
  console.log(`   📁 Origem da correção: ${sourceDir}`);
  console.log('   📁 Destino (backup): output/fixed/step{N}_*/');
  console.log(`   📁 Destino (versão): input-fixed/v${currentStep}/`);
  
  const fixStartTime = new Date();
  runCommand(fixCmd, 'Correção de gênero');
  const fixEndTime = new Date();
  console.log(`   ⏱️  Correção concluída em: ${(fixEndTime - fixStartTime) / 1000} segundos`);
  
  return true;
}