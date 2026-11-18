import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { expect, it } from 'vitest';

it('tracks a multi-MiB SSE line within a 64 MiB JS heap', () => {
  const bundle = buildSync({ entryPoints: [path.resolve('src/gateway/stream-terminal-events.ts')],
    platform: 'node', format: 'cjs', bundle: true, write: false }).outputFiles[0].text;
  const code = bundle + `
    const tracker=module.exports.createSseEventTracker();
    const line=Buffer.alloc(12*1024*1024,120);line[0]=58;
    tracker.push(line);tracker.push(Buffer.from('\\n\\n'));
    if(tracker.closeRetainedEvent().length>2)throw new Error('invalid boundary');
    process.stdout.write('bounded tracker');
  `;
  const result = spawnSync(process.execPath, ['--max-old-space-size=64', '-e', code], { encoding: 'utf8', timeout: 15000 });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toBe('bounded tracker');
});
