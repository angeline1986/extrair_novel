import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const MENU_WIDTH = 78;
const COLUMN_WIDTH = 35;

const styles = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  blue: '\x1b[34m',
  cyanBright: '\x1b[96m',
  green: '\x1b[32m',
  greenBright: '\x1b[92m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  white: '\x1b[37m'
};

export function createTerminal() {
  const rl = readline.createInterface({ input, output });
  let closed = false;

  rl.on('SIGINT', () => {
    if (!closed) {
      closed = true;
      output.write('\nEncerrando menu.\n');
      rl.close();
      process.exitCode = 0;
    }
  });

  return {
    async ask(question) {
      if (closed) return '';
      return rl.question(question);
    },
    close() {
      if (!closed) {
        closed = true;
        rl.close();
      }
    }
  };
}

export function clearScreen() {
  if (output.isTTY) output.write('\x1Bc');
}

export function printMainMenu() {
  output.write([
    topBorder('EPUB STRUCTURING'),
    emptyLine(),
    columns(
      sectionTitle('ANÁLISE E DETECÇÃO', 'blue'),
      sectionTitle('EDIÇÃO E ESTRUTURA', 'yellow')
    ),
    columns(menuItem('1', 'Analisar EPUB'), menuItem('7', 'Usar fonte de referência')),
    columns(menuItem('2', 'Detectar capítulos'), menuItem('8', 'Corrigir conteúdo pré-capítulo')),
    columns(menuItem('6', 'Verificar idioma'), menuItem('9', 'Converter / reconstruir como')),
    columns('', plain('EPUB 3', 3)),
    emptyLine(),
    columns(
      sectionTitle('REVISÃO E NAVEGAÇÃO', 'magenta'),
      sectionTitle('EXECUÇÃO E SISTEMA', 'green')
    ),
    columns(menuItem('3', 'Reestruturar capítulos'), menuItem('10', 'Validar EPUB')),
    columns(menuItem('4', 'Revisar títulos dos capítulos'), menuItem('11', 'Processamento completo', { primary: true })),
    columns(menuItem('5', 'Analisar / reconstruir sumário'), menuItem('12', 'Ver relatórios')),
    emptyLine(),
    line(`  ${color('0. Sair', 'dim')}`),
    emptyLine(),
    bottomBorder(),
    ''
  ].join('\n'));
}

export function printPrechapterMenu() {
  output.write(`
╔══════════════════════════════════════════════════════╗
║        CORRIGIR CONTEÚDO PRÉ-CAPÍTULO               ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  1. Analisar um EPUB                                ║
║  2. Corrigir um EPUB                                ║
║  3. Corrigir vários EPUBs                           ║
║  4. Analisar conjunto para merge                    ║
║  5. Juntar EPUBs                                    ║
║  6. Corrigir vários + juntar                        ║
║                                                      ║
║  0. Voltar                                          ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
}

export function printSectionHeader({ number, title, category }) {
  const style = categoryStyle(category);
  const label = `  ${number}. ${String(title).toUpperCase()}`;
  const separator = '─'.repeat(54);
  output.write([
    color(separator, style),
    color(label, style, true),
    color(separator, style),
    ''
  ].join('\n'));
}

export function printInfo(message) {
  output.write(`${message}\n`);
}

export function formatPrompt(message) {
  return color(message, 'white', true);
}

function topBorder(title) {
  const label = ` ${color(title, 'cyanBright', true)} `;
  return `┌──${label}${'─'.repeat(MENU_WIDTH - visibleLength(label) - 2)}┐`;
}

function bottomBorder() {
  return `└${'─'.repeat(MENU_WIDTH)}┘`;
}

function emptyLine() {
  return line('');
}

function line(content) {
  return `│${padVisible(content, MENU_WIDTH)}│`;
}

function columns(left, right) {
  return line(`  ${padVisible(left, COLUMN_WIDTH)}  ${padVisible(right, COLUMN_WIDTH)}`);
}

function sectionTitle(text, style) {
  return color(text, style);
}

function categoryStyle(category) {
  return {
    analysis: 'blue',
    review: 'magenta',
    edit: 'yellow',
    system: 'green'
  }[category] || 'white';
}

function menuItem(number, label, options = {}) {
  if (options.primary) return color(`${number}. ${label}`, 'greenBright', true);
  const numberText = color(`${number}.`, 'cyanBright');
  return `${numberText} ${label}`;
}

function plain(text, indent = 0) {
  return `${' '.repeat(indent)}${text}`;
}

function color(text, style, bold = false) {
  if (!output.isTTY) return text;
  const prefix = `${bold ? styles.bold : ''}${styles[style] || ''}`;
  return `${prefix}${text}${styles.reset}`;
}

function padVisible(text, width) {
  const value = String(text);
  const padding = Math.max(0, width - visibleLength(value));
  return `${value}${' '.repeat(padding)}`;
}

function visibleLength(text) {
  return String(text).replace(ANSI_PATTERN, '').length;
}
