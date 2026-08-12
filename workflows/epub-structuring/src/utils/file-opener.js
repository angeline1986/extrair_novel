import { spawn } from 'node:child_process';

export async function openFile(filePath, options = {}) {
  const platform = options.platform || process.platform;
  const spawnFn = options.spawn || spawn;
  const command = commandForPlatform(platform, filePath);
  if (!command) {
    return { ok: false, reason: `Abertura automática não suportada nesta plataforma: ${platform}` };
  }

  return new Promise((resolve) => {
    try {
      const child = spawnFn(command.command, command.args, {
        detached: true,
        stdio: 'ignore'
      });
      child.on('error', (error) => resolve({ ok: false, reason: error.message }));
      child.on('spawn', () => {
        child.unref?.();
        resolve({ ok: true });
      });
    } catch (error) {
      resolve({ ok: false, reason: error.message });
    }
  });
}

export function commandForPlatform(platform, filePath) {
  if (platform === 'darwin') return { command: 'open', args: [filePath] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', filePath] };
  if (platform === 'linux') return { command: 'xdg-open', args: [filePath] };
  return null;
}
