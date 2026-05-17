const path = require("path");

const workflowDir = path.resolve(__dirname, "../..");
const inputDir = path.join(workflowDir, "input");

// Tamanho-alvo por DOCX em KB (padrão: 400KB)
const TARGET_DOCX_KB = Number(process.argv[5] || 400);
const TARGET_DOCX_BYTES = TARGET_DOCX_KB * 1024;

// Blocos textuais acima disso não podem ser ignorados sem alerta
const MIN_SIGNIFICANT_TEXT_CHARS = 5000;

// Modo verbose
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === 'true';

module.exports = {
  workflowDir,
  inputDir,
  TARGET_DOCX_KB,
  TARGET_DOCX_BYTES,
  MIN_SIGNIFICANT_TEXT_CHARS,
  VERBOSE,
};