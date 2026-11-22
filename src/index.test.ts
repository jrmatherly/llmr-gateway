import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { waitForLoopbackListener } from './__tests__/listener-readiness';

const repoRoot = resolve(__dirname, '..');

function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolvePort(address.port);
        } else {
          reject(new Error('No port assigned.'));
        }
      });
    });
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolveExit) => {
    child.once('exit', () => resolveExit());
    child.kill('SIGKILL');
  });
}

describe('gateway entry', () => {
  it('serves no /manager or /agent route when GATEWAY_MANAGEMENT_ROUTES_ENABLED is false', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'gateway-entry-'));
    const entryFile = join(workDir, 'index.js');
    const configPath = join(workDir, 'gateway.config.json');
    await build({
      bundle: true,
      entryPoints: [join(repoRoot, 'src/index.ts')],
      external: ['fastify', 'undici', 'ws'],
      logLevel: 'silent',
      outfile: entryFile,
      platform: 'node',
      target: 'node20'
    });
    const port = await findFreePort();
    await writeFile(configPath, JSON.stringify({ host: '127.0.0.1', logging: { enabled: false }, port }));

    let output = '';
    const child = spawn(process.execPath, [entryFile], {
      cwd: workDir,
      env: {
        GATEWAY_CONFIG_PATH: configPath,
        GATEWAY_MANAGEMENT_ROUTES_ENABLED: 'false',
        HOME: workDir,
        NODE_PATH: join(repoRoot, 'node_modules'),
        PATH: process.env.PATH ?? ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      output += String(chunk);
    });

    try {
      await waitForLoopbackListener(port, 15000).catch((error) => {
        throw new Error(`Gateway did not start: ${output}`, { cause: error });
      });
      const statusOf = async (path: string) => (await fetch(`http://127.0.0.1:${port}${path}`)).status;

      expect(await statusOf('/health')).toBe(200);
      expect(await statusOf('/manager/config')).toBe(404);
      expect(await statusOf('/agent/tools')).toBe(404);
    } finally {
      await stopChild(child);
      await rm(workDir, { recursive: true, force: true });
    }
  }, 30000);
});
