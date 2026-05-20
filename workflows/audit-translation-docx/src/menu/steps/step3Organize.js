// src/menu/steps/step3Organize.js
// LEGADO: o fluxo atual publica direto em input-fixed/vN e output/.

import { log } from '../display.js';

export async function step3Organize() {
  log('\n📋 [LEGADO] Organização manual não é mais necessária.', 'cyan');
  log('   Versões: input-fixed/v1/, v2/, v3/...', 'cyan');
  log('   Arquivo final atual: output/', 'cyan');

  return { filesOrganized: 0 };
}
