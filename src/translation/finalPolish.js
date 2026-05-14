import { translateWithOllama } from "./ollamaClient.js";
import { chunkText } from "./chunker.js";
import { glossary } from "./glossary.js";

function buildFinalPolishPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
Você é um editor literário profissional especializado em português brasileiro.

Sua tarefa é fazer o POLIMENTO FINAL do texto abaixo.

IMPORTANTE:
- NÃO resuma.
- NÃO corte conteúdo.
- NÃO omita frases.
- NÃO simplifique.
- NÃO reescreva cenas.
- NÃO reduza parágrafos.
- NÃO altere significado.
- NÃO remova diálogos.
- NÃO adicione comentários.
- NÃO use markdown.
- NÃO explique nada.
- NÃO altere nomes próprios.
- NÃO altere tokens [[NAME_001]] etc.

Seu trabalho é SOMENTE:
- melhorar fluidez
- corrigir português robótico
- corrigir concordância
- corrigir pontuação
- suavizar traduções literais

Exemplos:
- "Este era uma sala" → "Esta era uma sala"
- "um contagem regressiva" → "uma contagem regressiva"
- "bordo da mesa" → "borda da mesa"

Mantenha:
- tom de webnovel
- suspense
- humor
- ritmo narrativo
- formatação
- parágrafos
- Preserve EXATAMENTE a mesma quantidade de parágrafos do texto original.
- Nunca remova linhas.
- Nunca combine parágrafos.

Glossário obrigatório:
${glossaryText}

Texto:
${text}
`.trim();
}

export async function finalPolish(text, options = {}) {
  const model = options.model ?? "qwen3:8b";

  // ↓ menor para evitar perda de conteúdo
  const maxChars = options.maxChars ?? 1200;

  console.log("✨ Polimento final da tradução...");

  const chunks = chunkText(text, maxChars);

  console.log(`✅ Total de blocos para polimento: ${chunks.length}`);

  const polishedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`✨ Polindo bloco ${i + 1}/${chunks.length}...`);

    const originalChunk = chunks[i];

    const prompt = buildFinalPolishPrompt(originalChunk);

    const polished = await translateWithOllama(prompt, model);

    // proteção contra truncamento/resumo
    const minimumExpectedSize = originalChunk.length * 0.75;
    const originalParagraphs = originalChunk.split(/\n+/).filter(Boolean).length;
    const newParagraphs = polished.split(/\n+/).filter(Boolean).length;

    if (
      polished.length < minimumExpectedSize ||
      newParagraphs < originalParagraphs * 0.7
    ) {
      console.warn(
        `⚠️ Bloco ${i + 1} parece truncado no polimento. Mantendo original.`
      );

      polishedChunks.push(originalChunk);
      continue;
    }

    polishedChunks.push(polished);
  }

  return polishedChunks.join("\n\n");
}