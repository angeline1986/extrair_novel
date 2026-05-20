#!/usr/bin/env node
// src/fix-gender-issues.js - Ponto de entrada do corretor de gênero
// 
// Uso:
//   node src/fix-gender-issues.js              # Usa o step atual
//   node src/fix-gender-issues.js --step=3     # Usa step específico
//   node src/fix-gender-issues.js --verbose    # Modo detalhado
//   node src/fix-gender-issues.js --skip-version # Pular criação de versão
//
// Comandos npm:
//   npm run fix:gender                         # Modo normal (step atual)
//   npm run fix:gender:verbose                 # Modo detalhado
//   npm run fix:gender:step                    # Usa --step (interativo)

import { main } from './fix-gender/fixGenderOrchestrator.js';

// Executar o orquestrador principal
main().then((success) => {
  if (success === false) process.exit(1);
}).catch(error => {
  console.error('\n❌ Erro fatal no corretor de gênero:');
  console.error(`   ${error.message}`);
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
  }
  console.error('\n💡 Para ajuda, execute: npm run version:help');
  process.exit(1);
});
