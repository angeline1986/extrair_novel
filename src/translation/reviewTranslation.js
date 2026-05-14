import { translateWithOllama } from "./ollamaClient.js";
import { buildReviewPrompt } from "./prompts.js";
import { chunkText } from "./chunker.js";

export async function reviewTranslation(text, options = {}) {
  const model = options.model ?? "qwen2.5:7b";

  // ↓ reduzido para evitar resumir/cortar
  const maxChars = options.maxChars ?? 1500;

  console.log("📝 Revisando tradução...");

  const chunks = chunkText(text, maxChars);

  console.log(`✅ Total de blocos para revisão: ${chunks.length}`);

  const reviewedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`🧹 Revisando bloco ${i + 1}/${chunks.length}...`);

    const originalChunk = chunks[i];

    const prompt = buildReviewPrompt(originalChunk);

    const reviewed = await translateWithOllama(prompt, model);

    // proteção contra truncamento/resumo
    const minimumExpectedSize = originalChunk.length * 0.75;
    const originalParagraphs = originalChunk.split(/\n+/).filter(Boolean).length;
    const newParagraphs = reviewed.split(/\n+/).filter(Boolean).length;

    if (
      reviewed.length < minimumExpectedSize ||
      newParagraphs < originalParagraphs * 0.7
    ) {
      console.warn(
        `⚠️ Bloco ${i + 1} parece truncado durante revisão. Mantendo original.`
      );

      reviewedChunks.push(originalChunk);
      continue;
    }

    reviewedChunks.push(reviewed);
  }

  return reviewedChunks.join("\n\n");
}