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
  log('║                                                                ║', 'cyan');
  log('║  Versão: 2.1.0 | Versionamento incremental (v1, v2, v3...)      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();
}

export function showMenu() {
  log('📋 ESCOLHA UMA OPÇÃO:', 'yellow');
  console.log();
  
  log('  ┌───────────── FLUXO PRINCIPAL ─────────────┐', 'dim');
  log('  1. 🚀 Gerar versão revisada da tradução', 'green');
  log('     Audita + normaliza entidades + corrige gênero + reaudita', 'dim');
  console.log();

  log('  ┌───────────── AUDITORIA ─────────────┐', 'dim');
  log('  2. 🔍 Auditar versão atual', 'white');
  log('  3. 🔍📋 Auditar versão atual com detalhes', 'white');
  console.log();
  
  log('  ┌───────────── CORREÇÃO ──────────────┐', 'dim');
  log('  4. 🔧 Normalizar entidades + corrigir gênero', 'white');
  log('  5. 🔧📋 Normalizar entidades + corrigir gênero com detalhes', 'white');
  console.log();
  
  log('  ┌───────────── RELATÓRIOS ────────────┐', 'dim');
  log('  6. 📊 Ver último relatório', 'cyan');
  log('  7. 🗑️  Limpar relatórios antigos', 'red');
  console.log();

  log('  ┌───────────── VERSÕES ───────────────┐', 'dim');
  log('  8. 📂 Ver status das versões', 'cyan');
  log('  9. 🔄 Restaurar versão específica', 'magenta');
  console.log();
  
  log('  ┌───────────── SISTEMA ───────────────┐', 'dim');
  log('  10. ❌ Sair', 'magenta');
  console.log();
  console.log('─'.repeat(64));
  console.log();
}
