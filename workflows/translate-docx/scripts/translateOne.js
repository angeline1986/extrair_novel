import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { saveDocxText } from "../../../src/io/docxWriter.js";

import { chunkText } from "../../../src/core/chunker.js";
import { translateWithOllama } from "../../../src/services/ollamaClient.js";
import { buildTranslationPrompt } from "../../../src/core/prompts.js";

import { reviewTranslation } from "../../../src/core/reviewTranslation.js";
import { finalPolish } from "../../../src/core/finalPolish.js";

import {
  validateModelOutput,
  normalizeSystemBlocks,
} from "../../../src/core/validator.js";

import {
  extractProperNames,
  protectNames,
  restoreNames,
} from "../../../src/core/nameProtector.js";

const TEST_MODE_FIRST_CHAPTER = false;
const DEFAULT_OUTPUT_DIR = path.resolve("workflows/translate-docx/output");

async function readDocxText(inputPath) {
  const result = await mammoth.extractRawText({
    path: inputPath,
  });

  return result.value;
}

function extractFirstChapter(text) {
  const chapterMatch = text.match(
    /Chapter\s+\d+[\s\S]*?(?=\nChapter\s+\d+|\nARC\s+\d+|$)/i
  );

  return chapterMatch ? chapterMatch[0] : text;
}

function logValidationWarnings(blockIndex, validation) {
  if (validation.warnings?.length > 0) {
    console.warn(`⚠️ Avisos na tradução do bloco ${blockIndex}.`);
    console.warn(validation.warnings.join("\n"));
  }

  if (validation.severeErrors?.length > 0) {
    console.warn(`🚨 Erros graves na tradução do bloco ${blockIndex}.`);
    console.warn(validation.severeErrors.join("\n"));
  }
}

function shouldAbortOnInvalidTranslation(options) {
  return options.abortOnInvalidTranslation ?? false;
}

function shouldUseFastMode(options) {
  return options.fastMode ?? false;
}

function shouldRunReview(options) {
  if (shouldUseFastMode(options)) return false;

  if (typeof options.runReview !== "undefined") {
    return options.runReview;
  }

  const env = process.env.ENABLE_REVIEW;
  if (typeof env === "string") {
    return env.toLowerCase() === "true";
  }

  return false;
}

function shouldRunPolish(options) {
  if (shouldUseFastMode(options)) return false;

  if (typeof options.runPolish !== "undefined") {
    return options.runPolish;
  }

  const env = process.env.ENABLE_FINAL_POLISH;
  if (typeof env === "string") {
    return env.toLowerCase() !== "false";
  }

  return true;
}

function isCriticalValidation(validation) {
  return validation.severity === "critical";
}

function buildOutputPath(inputPath, options = {}) {
  if (options.outputPath) return options.outputPath;

  const parsed = path.parse(inputPath);

  return path.join(
    DEFAULT_OUTPUT_DIR,
    `${parsed.name}.pt-BR${parsed.ext}`
  );
}

function logDetectedNames(names, limit = 40) {
  if (!names.length) return;

  console.log("📌 Amostra de nomes/termos protegidos:");
  console.log(names.slice(0, limit).join(", "));
}

export async function translateDocx(inputPath, options = {}) {
  //const model = options.model ?? "qwen3:8b";
  const model = options.model ?? "qwen2.5:7b";

  console.log(`📖 Lendo DOCX: ${inputPath}`);

  const fullText = await readDocxText(inputPath);

  const shouldTranslateOnlyFirstChapter =
    options.onlyFirstChapter ?? TEST_MODE_FIRST_CHAPTER;

  const originalText = shouldTranslateOnlyFirstChapter
    ? extractFirstChapter(fullText)
    : fullText;

  if (shouldTranslateOnlyFirstChapter) {
    console.log("🧪 Modo teste: traduzindo apenas o primeiro capítulo.");
  }

  if (shouldUseFastMode(options)) {
    console.log("⚡ Modo rápido ativado: revisão e polimento serão ignorados.");
  }

  console.log("🔍 Detectando nomes próprios...");

  const names = extractProperNames(originalText);

  console.log(`✅ Nomes/termos detectados para proteção: ${names.length}`);
  logDetectedNames(names);

  const { protectedText, map } = protectNames(originalText, names);

  console.log("✂️ Dividindo texto em blocos...");

  const chunks = chunkText(
    protectedText,
    options.translationMaxChars ?? 2600
  );

  console.log(`✅ Total de blocos: ${chunks.length}`);

  const translatedChunks = [];

  const stats = {
    accepted: 0,
    warnings: 0,
    fallback: 0,
    errors: 0,
  };

  for (let i = 0; i < chunks.length; i++) {
    const blockIndex = i + 1;

    console.log(`🌐 Traduzindo bloco ${blockIndex}/${chunks.length}...`);

    const originalChunk = chunks[i];

    const prompt = buildTranslationPrompt(originalChunk);

    let translated = "";

    try {
      translated = await translateWithOllama(prompt, model, {
        temperature: options.translationTemperature ?? 0.15,
        numPredict: options.translationNumPredict ?? 3072,
      });

      translated = normalizeSystemBlocks(translated);
    } catch (error) {
      stats.errors += 1;
      stats.fallback += 1;

      console.warn(
        `⚠️ Erro ao traduzir bloco ${blockIndex}. Mantendo original.`
      );

      console.warn(error.message);

      translatedChunks.push(originalChunk);
      continue;
    }

    const validation = validateModelOutput({
      original: originalChunk,
      output: translated,
      stage: "translation",
      minLengthRatio: options.translationMinLengthRatio ?? 0.55,
      maxLengthRatio: options.translationMaxLengthRatio ?? 1.8,
      minParagraphRatio: options.translationMinParagraphRatio ?? 0.55,
      requireSameNameTokens: true,
      checkResidualEnglish: true,
      checkSuspiciousPortuguese: true,
      checkCodes: true,
      checkProtectedTitles: true,
    });

    logValidationWarnings(blockIndex, validation);

    if (validation.warnings?.length > 0) {
      stats.warnings += 1;
    }

    if (isCriticalValidation(validation)) {
      console.warn(`🚨 Bloco ${blockIndex} falhou em validação crítica.`);

      if (shouldAbortOnInvalidTranslation(options)) {
        throw new Error(
          `Tradução abortada: bloco ${blockIndex} falhou em validação crítica.\n${(validation.severeErrors ?? validation.errors).join("\n")}`
        );
      }

      stats.fallback += 1;

      console.warn(
        `⚠️ Aplicando fallback crítico para o bloco ${blockIndex}. Mantendo versão anterior do bloco.`
      );

      translatedChunks.push(originalChunk);
      continue;
    }

    if (validation.severity === "warning") {
      console.warn(`⚠️ Bloco ${blockIndex} com warning leve; mantendo tradução gerada.`);
    }

    stats.accepted += 1;
    translatedChunks.push(translated);
  }

  let processedProtectedText = translatedChunks.join("\n\n");

  if (shouldRunReview(options)) {
    console.log("🔎 Iniciando revisão...");

    processedProtectedText = await reviewTranslation(
      processedProtectedText,
      {
        model: options.reviewModel ?? model,
        maxChars: options.reviewMaxChars ?? 2600,
        numPredict: options.reviewNumPredict ?? 3072,
      }
    );
  } else {
    console.log("⏭️ Revisão ignorada por configuração.");
  }

  if (shouldRunPolish(options)) {
    console.log("✨ Iniciando polimento final...");

    processedProtectedText = await finalPolish(
      processedProtectedText,
      {
        model: options.polishModel ?? model,
        maxChars: options.polishMaxChars ?? 2600,
        numPredict: options.polishNumPredict ?? 3072,
        temperature: options.polishTemperature ?? 0.1,
      }
    );
  } else {
    console.log("⏭️ Polimento final ignorado por configuração.");
  }

  console.log("🔓 Restaurando nomes protegidos...");

  const finalText = restoreNames(processedProtectedText, map);

  const outputPath = buildOutputPath(inputPath, options);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  console.log(`💾 Salvando DOCX traduzido: ${outputPath}`);

  await saveDocxText(outputPath, finalText);

  console.log("✅ Tradução concluída!");
  console.log("📊 Estatísticas da tradução:");
  console.log(`   ✅ Aceitos: ${stats.accepted}`);
  console.log(`   ⚠️ Com avisos: ${stats.warnings}`);
  console.log(`   🔁 Fallbacks: ${stats.fallback}`);
  console.log(`   ❌ Erros de chamada: ${stats.errors}`);

  return {
    inputPath,
    outputPath,
    namesDetected: names.length,
    chunks: chunks.length,
    onlyFirstChapter: shouldTranslateOnlyFirstChapter,
    reviewEnabled: shouldRunReview(options),
    polishEnabled: shouldRunPolish(options),
    stats,
  };
}

if (process.argv[1]?.endsWith("translateOne.js")) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error("Uso:");
    console.error(
      "node workflows/translate-docx/scripts/translateOne.js caminho/arquivo.docx [saida.docx]"
    );

    process.exit(1);
  }

  translateDocx(inputPath, { outputPath }).catch((error) => {
    console.error("❌ Erro ao traduzir DOCX:");
    console.error(error);

    process.exit(1);
  });
}
