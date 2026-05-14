import fs from "fs/promises";
import path from "path";

import { translateDocx } from "./translateDocx.js";

const INPUT_DIR =
  "/Users/alinesouza/Documents/TI/Projetos/Extrair_novel/build/docx/arcs";

const OUTPUT_DIR =
  "/Users/alinesouza/Documents/TI/Projetos/Extrair_novel/Traducao_corrigida/arcs";

async function main() {
  const files = await fs.readdir(INPUT_DIR);

  const docxFiles = files.filter((file) =>
    file.toLowerCase().endsWith(".docx")
  );

  console.log(`📚 Total de arquivos: ${docxFiles.length}`);

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
        model: "qwen2.5:7b",
      });

      console.log(`✅ Finalizado: ${file}`);
    } catch (error) {
      console.error(`❌ Erro em ${file}`);
      console.error(error);
    }
  }

  console.log("\n🎉 Tradução em lote concluída!");
}

main().catch(console.error);