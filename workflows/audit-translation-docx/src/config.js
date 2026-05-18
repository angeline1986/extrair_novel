// src/config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export default {
  thresholds: {
    minSizeRatio: 0.65,
    maxSizeRatio: 1.35,
    minParagraphRatio: 0.70,
    maxParagraphRatio: 1.30,
    maxEnglishWordsRatio: 0.08,
    maxRepeatLineRatio: 0.05,
    ollamaConfidenceThreshold: 0.65,
  },
  
  gtPatterns: {
    genderIssues: [
      { pattern: /o [a-z]+amente\b/i, description: "advérbio feminino com artigo masculino" },
      { pattern: /a [a-z]+or\b/i, description: "substantivo masculino com artigo feminino" },
    ],
    brokenSentences: [
      { pattern: /\.\s*[a-z]/g, description: "ponto seguido de minúscula (possível quebra)" },
      { pattern: /[a-z]\s+\./g, description: "espaço antes de ponto" },
    ],
    nameCorruption: [
      { pattern: /[A-Z][a-z]{2,}\s+[a-z]{2,}\b/i, description: "nome próprio em minúsculas" },
    ],
    autoTranslateMarks: [
      { pattern: /\[Traduzido automaticamente\]/i, description: "marca do Google Tradutor" },
    ],
  },
  
  suspiciousTerms: [
    { term: "gaze", expected: "olhar", note: "pode virar 'gaze' (curativo)" },
    { term: "bars", expected: "barras/bares", note: "ambiguidade comum" },
    { term: "intended", expected: "pretendido/intencionado", note: "uso incorreto frequente" },
    { term: "actually", expected: "na verdade", note: "tradução literal 'atuamente'" },
  ],
  
  ollama: {
    model: "qwen2.5:7b",
    endpoint: "http://localhost:11434",
    timeout: 30000,
    maxConcurrent: 3,
    cacheEnabled: true,
    cacheFile: path.join(projectRoot, "logs", "ollama-cache.json"),
  },
  
  versioning: {
    enabled: true,
    currentStepFile: path.join(projectRoot, '.current-step'),
    inputFixedDir: path.join(projectRoot, 'input-fixed'),
    maxSteps: 10,
    versionPrefix: 'v',
    timestampFormat: 'DD-MM-YYYY_HH-MM-SS',
  },
  
  files: {
    sourceDir: path.join(projectRoot, "input", "source"),
    translatedDir: path.join(projectRoot, "input", "translatedGoogle"),
    inputFixedDir: path.join(projectRoot, "input-fixed"),
    outputDir: path.join(projectRoot, "output"),           // ← mantido para compatibilidade
    logsDir: path.join(projectRoot, "logs"),
  },
  
  report: {
    csvDelimiter: ";",
    includeOllamaDetails: true,
  },
};
