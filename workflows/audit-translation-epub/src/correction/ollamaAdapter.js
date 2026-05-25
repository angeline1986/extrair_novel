import { createDisabledModelAdapter } from './modelAdapter.js';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen2.5:7b';
const DEFAULT_TIMEOUT_MS = 90000;

function envEnabled() {
  return ['1', 'true', 'yes', 'sim', 's'].includes(
    String(process.env.EPUB_AUDIT_OLLAMA || process.env.AUDIT_EPUB_OLLAMA || '').toLowerCase()
  );
}

function trimText(value, limit = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function buildPrompt(item) {
  return `Voce e um revisor de traducao literaria EN -> PT-BR.

Analise apenas o trecho abaixo e proponha uma sugestao localizada se houver base suficiente.
Nao reescreva o capitulo inteiro. Nao invente informacoes. Preserve nomes proprios e sentido.

ORIGINAL ALINHADO:
${trimText(item.originalAlignedText || '', 1200) || '(indisponivel)'}

PARAGRAFO ANTERIOR:
${trimText(item.previousParagraph || '') || '(indisponivel)'}

PARAGRAFO ATUAL:
${trimText(item.currentParagraph || item.textPreview || '') || '(indisponivel)'}

PARAGRAFO POSTERIOR:
${trimText(item.nextParagraph || '') || '(indisponivel)'}

PREVIEW DO PROBLEMA:
${trimText(item.textPreview || item.before || '') || '(indisponivel)'}

TIPO DO PROBLEMA:
${item.type || 'unknown'}

Responda SOMENTE em JSON valido, sem markdown:
{
  "suggestedAfter": "texto sugerido em PT-BR, ou string vazia se nao houver seguranca",
  "reason": "explique brevemente a relacao entre original, contexto e sugestao",
  "confidence": 0.0,
  "risks": ["risco 1"],
  "requiresHumanApproval": true
}

Regras:
- requiresHumanApproval deve ser true.
- suggestedAfter deve ser um ajuste localizado do paragrafo/trecho atual.
- Se nao houver contexto suficiente, use suggestedAfter vazio e confidence <= 0.5.
- Nao altere nomes proprios, numeros ou termos canonicos sem evidencia clara.`;
}

function extractJson(rawResponse) {
  const clean = String(rawResponse || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta do modelo sem JSON');
  return JSON.parse(match[0]);
}

function normalizeEndpoint(value) {
  return String(value || DEFAULT_ENDPOINT).replace(/\/+$/u, '');
}

function errorDetails(error) {
  return {
    message: error?.message || String(error),
    name: error?.name || null,
    code: error?.code || error?.cause?.code || null,
    cause: error?.cause?.message || null,
  };
}

async function callOllama({ endpoint, model, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${endpoint}/api/generate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 700,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`HTTP ${response.status}: ${response.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`);
      error.httpStatus = response.status;
      error.httpStatusText = response.statusText;
      throw error;
    }

    const data = await response.json();
    return {
      httpStatus: response.status,
      httpStatusText: response.statusText,
      response: String(data.response || ''),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createOllamaAdapter(options = {}) {
  const enabled = options.enabled ?? envEnabled();
  if (!enabled) {
    return createDisabledModelAdapter('set EPUB_AUDIT_OLLAMA=1 to enable optional Ollama suggestions');
  }

  const endpoint = normalizeEndpoint(
    options.endpoint ||
    process.env.OLLAMA_HOST ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.EPUB_AUDIT_OLLAMA_ENDPOINT ||
    DEFAULT_ENDPOINT
  );
  const model = options.model || process.env.OLLAMA_MODEL || process.env.EPUB_AUDIT_OLLAMA_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(options.timeoutMs || process.env.OLLAMA_TIMEOUT_MS || process.env.EPUB_AUDIT_OLLAMA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    name: 'ollama',
    provider: 'ollama',
    model,
    endpoint,
    timeoutMs,
    enabled: true,
    async suggest(item) {
      const prompt = buildPrompt(item);
      try {
        const result = await callOllama({ endpoint, model, prompt, timeoutMs });
        const rawResponse = result.response;
        const parsed = extractJson(rawResponse);
        return {
          ok: true,
          status: 'completed',
          httpStatus: result.httpStatus,
          httpStatusText: result.httpStatusText,
          provider: 'ollama',
          model,
          endpoint,
          timeoutMs,
          prompt,
          rawResponse,
          parsed,
        };
      } catch (error) {
        const details = errorDetails(error);
        return {
          ok: false,
          status: 'failed',
          httpStatus: error.httpStatus || null,
          httpStatusText: error.httpStatusText || null,
          provider: 'ollama',
          model,
          endpoint,
          timeoutMs,
          prompt,
          error: details.message,
          errorDetails: details,
        };
      }
    },
  };
}
