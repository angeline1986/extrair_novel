const { execFileSync } = require("node:child_process");
const path = require("node:path");

const script = path.resolve(
  __dirname,
  "../legacy/extractEpubArcsToDocx.cjs"
);

execFileSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});
