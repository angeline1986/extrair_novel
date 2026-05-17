const fs = require("fs");
const path = require("path");

function formatTimestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()].join("-") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("-")
  );
}

function findSingleEpub(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Pasta de entrada não encontrada: ${dir}`);
  }

  const epubFiles = fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".epub"))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  if (epubFiles.length === 0) {
    throw new Error(`Nenhum arquivo .epub encontrado em: ${dir}`);
  }

  if (epubFiles.length > 1) {
    throw new Error(
      `Mais de um arquivo .epub encontrado em ${dir}. Informe o EPUB explicitamente.`
    );
  }

  return path.join(dir, epubFiles[0]);
}

function safeFileName(name) {
  const normalizeText = (text) => String(text || "").trim().replace(/\s+/g, " ");
  return normalizeText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_");
}

function logVerbose(...args) {
  const { VERBOSE } = require('./config.cjs');
  if (VERBOSE) {
    console.log('[VERBOSE]', ...args);
  }
}

module.exports = {
  formatTimestampForPath,
  findSingleEpub,
  safeFileName,
  logVerbose,
};