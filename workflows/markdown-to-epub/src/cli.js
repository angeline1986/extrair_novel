import { buildBook } from './build.js';

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i + 1]) throw new Error(`Argumento inválido: ${argv[i] || '(vazio)'}`);
    options[argv[i].slice(2)] = argv[i + 1];
  }
  return options;
}

try {
  const result = buildBook(parse(process.argv.slice(2)));
  console.log(`EPUB validado: ${result.output} (${result.chapters.length} capítulos)`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
