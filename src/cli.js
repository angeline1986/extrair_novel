import { fileURLToPath } from "url";
import path from "path";
import { spawnSync } from "child_process";

const args = process.argv.slice(2);
const command = args[0] || "menu";

function usage() {
  console.log("Uso:");
  console.log("  npm start                     # Abre o menu principal");
  console.log("  node src/cli.js build:epub   # Gera EPUB a partir de workflows/docx-to-epub/input");
  console.log("  node src/cli.js help         # Mostra esta ajuda");
}

async function main() {
  switch (command) {
    case "menu": {
      const result = spawnSync("python3", [path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "menu.py")], { stdio: "inherit" });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
      break;
    }
    case "build:epub": {
      const { buildEpub } = await import("./epub/epubGenerator.js");
      await buildEpub();
      break;
    }
    case "help":
    default:
      usage();
      break;
  }
}

await main();
