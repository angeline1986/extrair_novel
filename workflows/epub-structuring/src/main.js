import { runFullPipeline } from './pipeline/full-pipeline.js';

const ROOT = process.cwd();

runFullPipeline(ROOT, { log: console.log }).catch((error) => {
  console.error('Falha ao executar workflow.');
  console.error(error.message);
  process.exit(1);
});
