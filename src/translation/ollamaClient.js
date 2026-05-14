const DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate";

export async function translateWithOllama(prompt, model = "qwen2.5:7b", options = {}) {
  const url = options.url ?? process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;

  const payload = {
    model,
    prompt,
    stream: false,
    system:
      options.system ??
      `Você é um tradutor e revisor literário profissional.
Responda SOMENTE com o texto final solicitado.
Não explique.
Não adicione comentários.
Não use markdown.
Não pense em voz alta.
Não inclua raciocínio.
Não inclua notas.
Não use tags como <think>, </think> ou /think.`,
    options: removeUndefinedValues({
      temperature: options.temperature ?? 0.15,
      top_p: options.topP ?? 0.85,
      top_k: options.topK,
      num_ctx: options.numCtx,
      num_predict: options.numPredict ?? 3072,
      repeat_penalty: options.repeatPenalty ?? 1.12,
    }),
  };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 180000;

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `AbortError/timeout no Ollama após ${timeoutMs}ms. Considere reduzir numPredict/maxChars ou aumentar timeoutMs.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await safeReadResponseText(response);

    throw new Error(
      `Erro no Ollama: ${response.status} ${response.statusText}${
        errorText ? `\n${errorText}` : ""
      }`
    );
  }

  const data = await response.json();

  if (!data || typeof data.response !== "string") {
    throw new Error("Resposta inválida do Ollama: campo 'response' ausente.");
  }

  return cleanModelOutput(data.response);
}

function removeUndefinedValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

async function safeReadResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function cleanModelOutput(text) {
  if (!text) return "";

  return text
    // remove blocos de raciocínio
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")

    // remove tags soltas
    .replace(/<\/?think>/gi, "")
    .replace(/<\/?thinking>/gi, "")
    .replace(/<\/?reasoning>/gi, "")
    .replace(/\/think/gi, "")

    // remove markdown
    .replace(/^```(?:text|markdown|txt|pt|portuguese)?\s*/i, "")
    .replace(/\s*```$/i, "")

    // remove prefixos comuns
    .replace(/^claro[,.!:\s-]*/i, "")
    .replace(/^aqui está[,.!:\s-]*/i, "")
    .replace(/^segue[,.!:\s-]*/i, "")
    .replace(/^tradução:\s*/i, "")
    .replace(/^texto traduzido:\s*/i, "")
    .replace(/^texto revisado:\s*/i, "")
    .replace(/^versão revisada:\s*/i, "")
    .replace(/^texto polido:\s*/i, "")
    .replace(/^versão polida:\s*/i, "")
    .replace(/^texto final:\s*/i, "")
    .replace(/^texto final solicitado:\s*/i, "")
    .replace(/^revisão:\s*/i, "")
    .replace(/^polimento:\s*/i, "")
    .replace(/^versão final:\s*/i, "")
    .replace(/^resultado final:\s*/i, "")
    .replace(/^resultado:\s*/i, "")

    // limpa espaços estranhos
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}