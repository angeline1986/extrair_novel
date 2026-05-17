import { spawn } from 'node:child_process';
import path from 'node:path';

const script = path.resolve(new URL('./extractEpubArcsToDocx.cjs', import.meta.url).pathname);
const args = process.argv.slice(2);

const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });

child.on('exit', code => process.exit(code));
child.on('error', error => {
  console.error(error);
  process.exit(1);
});
