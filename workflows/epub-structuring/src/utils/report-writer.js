import fs from 'fs-extra';

export async function writeJsonReport(filePath, data) {
  await fs.ensureDir(new URL('.', `file://${filePath}`).pathname);
  await fs.writeJson(filePath, data, { spaces: 2 });
}
