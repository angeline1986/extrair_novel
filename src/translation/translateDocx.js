import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";

import { translateWithOllama } from "./ollamaClient.js";
import { buildTranslationPrompt } from "./prompts.js";
import { chunkText } from "./chunker.js";
import {
  extractProperNames,
  protectNames,
  restoreNames,
} from "./nameProtector.js";

async function readDocxText(inputPath) {
  const result = await mammoth.extractRawText({ path: inputPath });
  return result.value;
}

async function saveDocxText(outputPath, text) {
  const paragraphs = text
    .split(/\n+/)
    .map((line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
    );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}

export async function translateDocx(inputPath, options = {}) {
  const model = options.model ?? "qwen2.5:7b";

  console.log(`📖 Lendo DOCX: ${inputPath}`);

  //const originalText = await readDocxText(inputPath);
  const fullText = await readDocxText(inputPath);

const chapterMatch = fullText.match(
  /Chapter\s+\d+[\s\S]*?(?=\nChapter\s+\d+|\nARC\s+\d+|$)/i
);

const originalText = chapterMatch ? chapterMatch[0] : fullText;

console.log("🧪 Modo teste: traduzindo apenas 1 capítulo.");

  console.log("🔎 Detectando nomes próprios...");
  const names = extractProperNames(originalText);

  console.log(`✅ Nomes detectados: ${names.length}`);
  console.log(names.slice(0, 30).join(", "));

  const { protectedText, map } = protectNames(originalText, names);

  console.log("✂️ Dividindo em blocos...");
  const chunks = chunkText(protectedText, options.maxChars ?? 3000);

  console.log(`✅ Total de blocos: ${chunks.length}`);

  const translatedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`🌐 Traduzindo bloco ${i + 1}/${chunks.length}...`);

    const prompt = buildTranslationPrompt(chunks[i]);
    const translated = await translateWithOllama(prompt, model);

    translatedChunks.push(translated);
  }

  const translatedProtectedText = translatedChunks.join("\n\n");
  const finalText = restoreNames(translatedProtectedText, map);

  const parsed = path.parse(inputPath);
  const outputPath =
    options.outputPath ??
    path.join(
      "Traducao_corrigida",
      `${parsed.name}.pt-BR${parsed.ext}`
    );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  console.log(`💾 Salvando DOCX traduzido: ${outputPath}`);
  await saveDocxText(outputPath, finalText);

  console.log("✅ Tradução concluída!");

  return {
    inputPath,
    outputPath,
    names,
    chunks: chunks.length,
  };
}

// Execução direta via terminal
if (process.argv[1]?.endsWith("translateDocx.js")) {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Uso:");
    console.error("node src/translation/translateDocx.js caminho/arquivo.docx");
    process.exit(1);
  }

  translateDocx(inputPath).catch((error) => {
    console.error("❌ Erro ao traduzir DOCX:");
    console.error(error);
    process.exit(1);
  });
}