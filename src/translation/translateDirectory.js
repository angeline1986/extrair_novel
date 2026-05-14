import fs from "fs/promises";
import path from "path";

import { translateDocx } from "./translateDocx.js";

const INPUT_DIR =
  "/Users/alinesouza/Documents/TI/Projetos/Extrair_novel/build/docx/arcs";

const OUTPUT_DIR =
  "/Users/alinesouza/Documents/TI/Projetos/Extrair_novel/Traducao_corrigida/arcs";

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = await fs.readdir(INPUT_DIR);

  const docxFiles = files
    .filter((file) => file.toLowerCase().endsWith(".docx"))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  console.log(`📚 Total de arquivos: ${docxFiles.length}`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of docxFiles) {
    const inputPath = path.join(INPUT_DIR, file);

    const outputPath = path.join(
      OUTPUT_DIR,
      file.replace(".docx", ".pt-BR.docx")
    );

    console.log("\n==============================");
    console.log(`🚀 Traduzindo: ${file}`);
    console.log("==============================\n");

    try {
      await translateDocx(inputPath, {
        outputPath,
        model: "qwen3:8b",
        onlyFirstChapter: false,
        runReview: true,
        runPolish: true,
        abortOnInvalidTranslation: false,
        translationMaxChars: 3000,
        reviewMaxChars: 1500,
        polishMaxChars: 1200,
        translationNumPredict: 4096,
        reviewNumPredict: 2048,
        polishNumPredict: 2048,
      });

      successCount += 1;

      console.log(`✅ Finalizado: ${file}`);
    } catch (error) {
      errorCount += 1;

      console.error(`❌ Erro em ${file}`);
      console.error(error);
    }
  }

  console.log("\n🎉 Tradução em lote concluída!");
  console.log(`✅ Sucessos: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
}

main().catch(console.error);