import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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
  output.write(`
╔══════════════════════════════════════════════════════╗
║               EPUB STRUCTURING                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  1. Analisar EPUB                                   ║
║  2. Detectar capítulos                              ║
║  3. Reestruturar capítulos                          ║
║  4. Revisar títulos dos capítulos                   ║
║  5. Analisar / reconstruir sumário                  ║
║  6. Verificar idioma                                ║
║  7. Usar PDF como referência                        ║
║  8. Corrigir conteúdo pré-capítulo                  ║
║  9. Converter / reconstruir como EPUB 3             ║
║ 10. Validar EPUB                                    ║
║                                                      ║
║ 11. Processamento completo                          ║
║ 12. Ver relatórios                                  ║
║                                                      ║
║  0. Sair                                            ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
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

export function printInfo(message) {
  output.write(`${message}\n`);
}
