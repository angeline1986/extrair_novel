import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export async function main(argv = process.argv.slice(2)) {
  const inputDir = path.resolve("workflows/translate-docx/input");
  const outputDir = path.resolve("workflows/translate-docx/output");

  await fs.mkdir(outputDir, { recursive: true });

  const files = (await fs.readdir(inputDir))
    .filter(file => file.endsWith(".docx"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(
      outputDir,
      file.replace(/\.docx$/i, ".pt-BR.docx")
    );

    try {
      await fs.access(outputPath);
      console.log(`⏭️  Pulando já existente: ${file}`);
      continue;
    } catch {}

    console.log(`\n🚀 Iniciando: ${file}`);

    await runCommand("node", [
      "workflows/translate-docx/scripts/translateOne.js",
      inputPath,
      outputPath,
    ]);

    console.log(`✅ Concluído: ${file}`);
  }

  console.log("\n🎉 Todos os arquivos foram processados.");
}

if (process.argv[1]?.endsWith("translateSequential.js")) {
  await main();
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} terminou com código ${code}`));
    });

    child.on("error", reject);
  });
}
