import { execFile } from 'node:child_process';
import path from 'node:path';

const script = path.resolve(new URL('../../../../src/services/extractEpubArcsToDocx.cjs', import.meta.url).pathname);
const args = process.argv.slice(2);

const child = execFile(process.execPath, [script, ...args], { stdio: 'inherit' });

child.on('exit', code => process.exit(code));
