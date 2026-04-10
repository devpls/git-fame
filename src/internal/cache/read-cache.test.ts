import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { readCache } from './read-cache.js';

describe('readCache', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('returns undefined when file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    expect(readCache(join(dir, 'nonexistent.json'))).toBeUndefined();
  });

  it('reads and rehydrates Date fields', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'test.json');
    const report = {
      meta: {
        version: '0.1.0',
        generatedAt: '2024-01-01T00:00:00.000Z',
        durationMs: 100,
        cached: false,
      },
      repo: {
        path: '/repo',
        headSha: 'abc',
        headRef: 'HEAD',
        totals: { lines: 1, commits: 1, files: 1 },
      },
      authors: [
        {
          name: 'Alice',
          email: 'a@x',
          linesAlive: 1,
          linesAdded: 1,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: '2024-01-01T00:00:00.000Z',
          lastCommit: '2024-01-01T00:00:00.000Z',
        },
      ],
      warnings: [],
    };
    writeFileSync(file, JSON.stringify(report), 'utf8');

    const result = readCache(file);
    expect(result).toBeDefined();
    expect(result!.meta.generatedAt).toBeInstanceOf(Date);
    expect(result!.authors[0]!.firstCommit).toBeInstanceOf(Date);
    expect(result!.authors[0]!.lastCommit).toBeInstanceOf(Date);
  });

  it('returns undefined for corrupt JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{corrupt', 'utf8');
    expect(readCache(file)).toBeUndefined();
  });
});
