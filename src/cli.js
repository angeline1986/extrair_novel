import { fileURLToPath } from "url";
import path from "path";

const args = process.argv.slice(2);
const command = args[0] || "help";

function usage() {
  console.log("Uso:");
  console.log("  node src/cli.js build:epub   # Gera EPUB a partir de workflows/docx-to-epub/input");
  console.log("  node src/cli.js help         # Mostra esta ajuda");
}

async function main() {
  switch (command) {
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
