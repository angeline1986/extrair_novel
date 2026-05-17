// src/config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..'); // Sobe para a raiz do audit-translation-docx

export default {
  // Limiares de validação (tolerantes)
  thresholds: {
    // Tamanho mínimo da tradução em relação ao original (porcentagem)
    minSizeRatio: 0.65,        // 65% → muito tolerante, Google Tradutor costuma manter ~80-90%
    maxSizeRatio: 1.35,        // 135% → aceita expansão natural
    
    // Parágrafos
    minParagraphRatio: 0.70,   // 70% dos parágrafos preservados
    maxParagraphRatio: 1.30,   // 130% (aceita fusão/divisão de parágrafos)
    
    // Inglês residual
    maxEnglishWordsRatio: 0.08, // Máximo 8% de palavras em inglês
    
    // Repetição suspeita
    maxRepeatLineRatio: 0.05,   // 5% do texto pode ser repetido
    
    // Ollama
    ollamaConfidenceThreshold: 0.65, // Só reporta se confiança > 65%
  },
  
  // Padrões do Google Tradutor (problemas comuns)
  gtPatterns: {
    // Gênero errado (comum em português)
    genderIssues: [
      { pattern: /o [a-z]+amente\b/i, description: "advérbio feminino com artigo masculino" },
      { pattern: /a [a-z]+or\b/i, description: "substantivo masculino com artigo feminino" },
    ],
    // Frases quebradas
    brokenSentences: [
      { pattern: /\.\s*[a-z]/g, description: "ponto seguido de minúscula (possível quebra)" },
      { pattern: /[a-z]\s+\./g, description: "espaço antes de ponto" },
    ],
    // Nomes próprios alterados
    nameCorruption: [
      { pattern: /[A-Z][a-z]{2,}\s+[a-z]{2,}\b/i, description: "nome próprio em minúsculas" },
    ],
    // Marcas de tradução automática
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
    timeout: 30000, // 30 segundos
    maxConcurrent: 3, // Limite de requisições simultâneas
    cacheEnabled: true,
    cacheFile: path.join(projectRoot, "logs", "ollama-cache.json"),
  },
  
  // Arquivos (corrigido para usar a raiz do projeto)
  files: {
    sourceDir: path.join(projectRoot, "input", "source"),
    translatedDir: path.join(projectRoot, "input", "translated"),
    outputDir: path.join(projectRoot, "output"),
    logsDir: path.join(projectRoot, "logs"),
  },
  
  // Report
  report: {
    csvDelimiter: ";",
    includeOllamaDetails: true,
  },
};