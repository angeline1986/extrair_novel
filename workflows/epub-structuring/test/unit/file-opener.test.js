import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { commandForPlatform, openFile } from '../../src/utils/file-opener.js';

test('file opener chooses platform specific commands', () => {
  assert.deepEqual(commandForPlatform('darwin', '/tmp/report.html'), { command: 'open', args: ['/tmp/report.html'] });
  assert.deepEqual(commandForPlatform('linux', '/tmp/report.html'), { command: 'xdg-open', args: ['/tmp/report.html'] });
  assert.deepEqual(commandForPlatform('win32', 'C:\\report.html'), { command: 'cmd', args: ['/c', 'start', '', 'C:\\report.html'] });
  assert.equal(commandForPlatform('aix', '/tmp/report.html'), null);
});

test('file opener resolves success on spawn without blocking caller', async () => {
  const calls = [];
  const result = await openFile('/tmp/report.html', {
    platform: 'darwin',
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      child.unref = () => {};
      queueMicrotask(() => child.emit('spawn'));
      return child;
    }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].command, 'open');
  assert.deepEqual(calls[0].args, ['/tmp/report.html']);
  assert.equal(calls[0].options.detached, true);
});

test('file opener reports unsupported platforms and spawn errors', async () => {
  const unsupported = await openFile('/tmp/report.html', { platform: 'aix' });
  assert.equal(unsupported.ok, false);

  const failed = await openFile('/tmp/report.html', {
    platform: 'linux',
    spawn: () => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('error', new Error('xdg-open missing')));
      return child;
    }
  });
  assert.equal(failed.ok, false);
  assert.match(failed.reason, /xdg-open missing/);
});
