import fs from 'fs-extra';
import path from 'path';

export async function writeJsonReport(filePath, data) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}
