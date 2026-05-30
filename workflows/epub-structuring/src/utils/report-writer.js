import fs from 'fs-extra';

export async function writeJsonReport(filePath, data) {
  await fs.writeJson(filePath, data, {
    spaces: 2,
    EOL: '\n'
  });
}
