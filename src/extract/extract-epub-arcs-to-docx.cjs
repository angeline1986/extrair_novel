const { execFileSync } = require("node:child_process");
const path = require("node:path");

const script = path.resolve(
  __dirname,
  "../../workflows/epub-to-docx/scripts/extractEpubArcsToDocx.cjs"
);

execFileSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});
