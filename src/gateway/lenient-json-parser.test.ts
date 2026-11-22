import Fastify from 'fastify';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { registerLenientJsonParser } from './lenient-json-parser';

const hasZstdCli = spawnSync('zstd', ['--version'], { encoding: 'utf8' }).status === 0;

describe('registerLenientJsonParser', () => {
  it('accepts JSON payload when Content-Length is incorrect', async () => {
    const app = Fastify({ logger: false });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json',
          'content-length': '999'
        },
        payload: JSON.stringify({ hello: 'world' })
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        body: {
          hello: 'world'
        }
      });
    } finally {
      await app.close();
    }
  });

  it('still rejects invalid JSON payload', async () => {
    const app = Fastify({ logger: false });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json'
        },
        payload: '{invalid-json'
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toMatchObject({
        code: 'FST_ERR_CTP_INVALID_JSON_BODY'
      });
    } finally {
      await app.close();
    }
  });

  it('keeps Fastify bodyLimit enforcement', async () => {
    const app = Fastify({ logger: false, bodyLimit: 32 });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          message: 'this payload is intentionally longer than 32 bytes'
        })
      });

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body)).toMatchObject({
        code: 'FST_ERR_CTP_BODY_TOO_LARGE'
      });
    } finally {
      await app.close();
    }
  });

  it('accepts gzip-compressed JSON body', async () => {
    const app = Fastify({ logger: false });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip'
        },
        payload: gzipSync(Buffer.from(JSON.stringify({ hello: 'compressed' }), 'utf8'))
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        body: {
          hello: 'compressed'
        }
      });
    } finally {
      await app.close();
    }
  });

  it('rejects gzip-compressed JSON body when decompressed output exceeds bodyLimit', async () => {
    const app = Fastify({ logger: false, bodyLimit: 128 });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const source = Buffer.from(JSON.stringify({ message: 'a'.repeat(4096) }), 'utf8');
      const compressed = gzipSync(source);
      expect(compressed.length).toBeLessThan(128);

      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip'
        },
        payload: compressed
      });

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body)).toMatchObject({
        code: 'FST_ERR_CTP_BODY_TOO_LARGE'
      });
    } finally {
      await app.close();
    }
  });

  (hasZstdCli ? it : it.skip)('accepts zstd-compressed JSON body', async () => {
    const app = Fastify({ logger: false });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const source = Buffer.from(JSON.stringify({ hello: 'zstd' }), 'utf8');
      const compressed = spawnSync('zstd', ['--stdout', '--quiet'], { input: source });
      if (compressed.status !== 0 || !compressed.stdout) {
        throw new Error(`Failed to compress test payload with zstd: ${compressed.stderr?.toString('utf8') || ''}`);
      }

      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'zstd'
        },
        payload: compressed.stdout
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        body: {
          hello: 'zstd'
        }
      });
    } finally {
      await app.close();
    }
  });

  (process.platform === 'win32' ? it.skip : it)('runs zstd with only PATH from the environment', async () => {
    const binDir = await mkdtemp(join(tmpdir(), 'gateway-zstd-env-'));
    await writeFile(
      join(binDir, 'zstd'),
      [
        '#!/bin/sh',
        'cat >/dev/null',
        "names=$(env | sed -n 's/^\\([A-Za-z_][A-Za-z0-9_]*\\)=.*/\\1/p' | tr '\\n' ' ')",
        'printf \'{"names":"%s","path":"%s"}\' "$names" "$PATH"',
        ''
      ].join('\n'),
      { mode: 0o755 }
    );
    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${originalPath ?? ''}`;
    process.env.GATEWAY_ZSTD_ENV_PROBE = 'from-parent';
    const app = Fastify({ logger: false });
    registerLenientJsonParser(app);
    app.post('/echo', async (request) => {
      return { body: request.body };
    });

    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/echo',
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'zstd'
        },
        payload: Buffer.from('ignored')
      });

      expect(response.statusCode).toBe(200);
      const { body } = JSON.parse(response.body) as { body: { names: string; path: string } };
      expect(body.path).toBe(process.env.PATH);
      const names = body.names.trim().split(/\s+/);
      expect(names).toContain('PATH');
      expect(names.filter((name) => !['PATH', 'PWD', 'SHLVL', '_'].includes(name))).toEqual([]);
    } finally {
      await app.close();
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
      delete process.env.GATEWAY_ZSTD_ENV_PROBE;
      await rm(binDir, { recursive: true, force: true });
    }
  });
});
