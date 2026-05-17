// src/ollamaReviewer.js
// Revisão com Ollama apenas para casos suspeitos

import fs from 'fs';
import crypto from 'crypto';
import config from './config.js';
import { log, delay } from './utils.js';

// Cache para evitar reprocessamento
let cache = {};

export function initCache() {
  const cacheFile = config.ollama.cacheFile;
  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      log(`Cache carregado: ${Object.keys(cache).length} entradas`, 'DEBUG');
    } catch (err) {
      log(`Erro ao carregar cache: ${err.message}`, 'WARN');
    }
  }
}

export function saveCache() {
  const cacheFile = config.ollama.cacheFile;
  const cacheDir = config.files.logsDir;
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
  log(`Cache salvo: ${Object.keys(cache).length} entradas`, 'DEBUG');
}

function getCacheKey(sourceText, translationText) {
  const hash = crypto.createHash('md5');
  hash.update(sourceText.substring(0, 500));
  hash.update(translationText.substring(0, 500));
  return hash.digest('hex');
}

export async function reviewWithOllama(sourceText, translationText, options = {}) {
  const { force = false, timeout = config.ollama.timeout } = options;
  
  // Verificar cache
  const cacheKey = getCacheKey(sourceText, translationText);
  if (!force && cache[cacheKey]) {
    log(`Usando cache para: ${cacheKey.substring(0, 8)}`, 'DEBUG');
    return cache[cacheKey];
  }
  
  // Preparar prompt
  const prompt = `Você é um auditor de tradução especializado.

Compare o texto ORIGINAL (inglês) com a TRADUÇÃO (português).

ORIGINAL:
---
${sourceText.substring(0, 1500)}
---

TRADUÇÃO:
---
${translationText.substring(0, 1500)}
---

Responda SOMENTE em JSON, sem texto adicional:

{
  "status": "ok|warning|fail",
  "confidence": 0.0-1.0,
  "problem": "descrição resumida do problema (se houver)",
  "suggestion": "sugestão de correção (opcional)"
}

Regras:
- status "ok": sentido preservado, tradução aceitável
- status "warning": perda pequena de significado, gírias, nomes próprios alterados
- status "fail": perda grave de sentido, frase incompreensível, conteúdo muito diferente
- confidence: sua confiança nesta avaliação (0.5 = pouco confiante, 1.0 = muito confiante)`;

  try {
    const response = await callOllama(prompt, timeout);
    const parsed = parseOllamaResponse(response);
    
    // Salvar no cache
    cache[cacheKey] = parsed;
    
    return parsed;
  } catch (err) {
    log(`Erro no Ollama: ${err.message}`, 'ERROR');
    return {
      status: 'warning',
      confidence: 0.3,
      problem: `Erro na análise: ${err.message}`,
      suggestion: 'Revisar manualmente',
      error: true,
    };
  }
}

async function callOllama(prompt, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(`${config.ollama.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Baixo para respostas consistentes
          num_predict: 500,
        },
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function parseOllamaResponse(response) {
  // Tentar extrair JSON da resposta
  let jsonMatch = response.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    log(`Resposta sem JSON: ${response.substring(0, 200)}`, 'WARN');
    return {
      status: 'warning',
      confidence: 0.3,
      problem: 'Resposta do modelo não pôde ser interpretada',
      suggestion: 'Revisar manualmente',
    };
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validar campos obrigatórios
    if (!parsed.status || !['ok', 'warning', 'fail'].includes(parsed.status)) {
      parsed.status = 'warning';
    }
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = 0.5;
    }
    
    return parsed;
  } catch (err) {
    log(`Erro ao parsear JSON: ${err.message}`, 'WARN');
    return {
      status: 'warning',
      confidence: 0.3,
      problem: 'Erro ao processar resposta do modelo',
      suggestion: 'Revisar manualmente',
    };
  }
}

// Revisar apenas itens suspeitos (filtro prévio)
export async function reviewSuspiciousItems(suspiciousItems, options = {}) {
  const { concurrency = config.ollama.maxConcurrent } = options;
  const results = [];
  
  // Limitar concorrência
  for (let i = 0; i < suspiciousItems.length; i += concurrency) {
    const batch = suspiciousItems.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item, idx) => {
        log(`Revisando (${i + idx + 1}/${suspiciousItems.length}): ${item.sourceTitle || item.type}`, 'INFO');
        const review = await reviewWithOllama(item.sourceText, item.translationText);
        await delay(500); // Pequena pausa entre requisições
        return { ...item, review };
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}