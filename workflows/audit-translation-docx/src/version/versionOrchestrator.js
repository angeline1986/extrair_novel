// src/version/versionOrchestrator.js
// Ponto de entrada do módulo de versionamento

import { runVersionCommand } from './versionCommands.js';

// Executar o CLI
runVersionCommand().catch(error => {
  console.error('\n❌ Erro no gerenciador de versões:');
  console.error(`   ${error.message}`);
  process.exit(1);
});