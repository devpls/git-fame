import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { writeCache } from './write-cache.js';
import type { Report } from '../../types/report.type.js';

const makeReport = (): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00.000Z'),
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
      firstCommit: new Date('2024-01-01T00:00:00.000Z'),
      lastCommit: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
  warnings: [],
});

describe('writeCache', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('writes valid JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'report.json');
    writeCache(file, makeReport());
    expect(existsSync(file)).toBe(true);
  });

  it('creates parent directories if needed', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'sub', 'dir', 'report.json');
    writeCache(file, makeReport());
    expect(existsSync(file)).toBe(true);
  });

  it('leaves no tmp files behind', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'report.json');
    writeCache(file, makeReport());
    const files = readdirSync(dir);
    expect(files).toEqual(['report.json']);
  });
});
