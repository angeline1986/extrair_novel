// src/config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export default {
  // Limiares de validação (tolerantes)
  thresholds: {
    minSizeRatio: 0.65,
    maxSizeRatio: 1.35,
    minParagraphRatio: 0.70,
    maxParagraphRatio: 1.30,
    maxEnglishWordsRatio: 0.08,
    maxRepeatLineRatio: 0.05,
    ollamaConfidenceThreshold: 0.65,
  },
  
  // Padrões do Google Tradutor
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
  
  // Termos suspeitos comuns em traduções ruins
  suspiciousTerms: [
    { term: "gaze", expected: "olhar", note: "pode virar 'gaze' (curativo)" },
    { term: "bars", expected: "barras/bares", note: "ambiguidade comum" },
    { term: "intended", expected: "pretendido/intencionado", note: "uso incorreto frequente" },
    { term: "actually", expected: "na verdade", note: "tradução literal 'atuamente'" },
  ],
  
  // Ollama
  ollama: {
    model: "qwen2.5:7b",
    endpoint: "http://localhost:11434",
    timeout: 30000,
    maxConcurrent: 3,
    cacheEnabled: true,
    cacheFile: path.join(projectRoot, "logs", "ollama-cache.json"),
  },
  
  // ============================================
  // Versionamento incremental
  // ============================================
  versioning: {
    // Ativar/desativar versionamento
    enabled: true,
    
    // Arquivo que armazena o step atual (ex: .current-step)
    currentStepFile: path.join(projectRoot, '.current-step'),
    
    // Diretório onde as versões serão armazenadas (DEPRECIADO - usar inputFixedDir)
    versionsDir: path.join(projectRoot, 'input', 'versions'),
    
    // NOVO: Diretório principal para versões corrigidas
    inputFixedDir: path.join(projectRoot, 'input-fixed'),
    
    // Número máximo de versões mantidas (evita acúmulo excessivo)
    maxSteps: 10,
    
    // Prefixo das pastas de versão (ex: v1, v2, v3...)
    versionPrefix: 'v',
    
    // Formato do timestamp nos backups
    timestampFormat: 'DD-MM-YYYY_HH-MM-SS',
  },
  
  // Arquivos
  files: {
    sourceDir: path.join(projectRoot, "input", "source"),
    translatedDir: path.join(projectRoot, "input", "translatedGoogle"),  // NUNCA modificar
    translatedFixedDir: path.join(projectRoot, "input", "translated-fixed"),
    inputFixedDir: path.join(projectRoot, "input-fixed"),         // NOVO: versões corrigidas
    outputDir: path.join(projectRoot, "output"),
    logsDir: path.join(projectRoot, "logs"),
    backupDir: path.join(projectRoot, "input", "backup"),
  },
  
  // Report
  report: {
    csvDelimiter: ";",
    includeOllamaDetails: true,
  },
};