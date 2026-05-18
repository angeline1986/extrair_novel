// src/menu/display.js
// Exibição do menu e cores

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

export function clearScreen() {
  console.clear();
}

export function showHeader() {
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                AUDITORIA DE TRADUÇÕES - GOOGLE TRADUTOR        ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║  Audita e corrige problemas comuns de gênero em traduções      ║', 'cyan');
  log('║  automáticas do Google Tradutor.                               ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();
}

export function showMenu() {
  log('📋 ESCOLHA UMA OPÇÃO:', 'yellow');
  console.log();
  log('  1. 🔍 Auditoria normal', 'white');
  log('  2. 🔍📋 Auditoria com detalhes (verbose)', 'white');
  log('  3. 🔧 Corrigir problemas de gênero', 'white');
  log('  4. 🔧📋 Corrigir problemas de gênero (verbose)', 'white');
  log('  5. 🚀 Workflow completo (auditar + corrigir)', 'green');
  log('  6. 📊 Ver último relatório', 'cyan');
  log('  7. 🗑️  Limpar relatórios antigos', 'red');
  log('  8. ❌ Sair', 'magenta');
  console.log();
  console.log('─'.repeat(64));
  console.log();
}