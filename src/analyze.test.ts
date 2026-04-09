import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { buildRepo } from '../tests/helpers/build-repo.js';

describe('analyze', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('produces a Report with correct totals for a two-author repo', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    expect(report.meta.version).toBe('0.1.0');
    expect(report.repo.path).toBe(dir);
    expect(report.repo.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(report.authors).toHaveLength(2);

    const alice = report.authors.find((a) => a.email === 'alice@example.com');
    const bob = report.authors.find((a) => a.email === 'bob@example.com');
    expect(alice?.linesAlive).toBe(1);
    expect(bob?.linesAlive).toBe(1);
    expect(alice?.linesAdded).toBe(2);
    expect(bob?.linesAdded).toBe(1);
    expect(bob?.linesDeleted).toBe(1);
  });

  it('returns an empty authors array for an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.authors).toEqual([]);
    expect(report.repo.totals).toEqual({ lines: 0, commits: 0, files: 0 });
  });

  it('records a duration greater than or equal to zero', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('excludes generated files (lock files) by default', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Only a.txt contributes 1 line; package-lock.json is excluded
    expect(alice?.linesAlive).toBe(1);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(true);
  });

  it('includes generated files when include.generated is true', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, include: { generated: true } });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Both files contribute: a.txt (1 line) + package-lock.json (1 line) = 2 lines
    expect(alice?.linesAlive).toBe(2);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(false);
  });

  it('merges identities via .mailmap by default', async () => {
    const dir = buildRepo([
      {
        author: 'Alice Old <alice@old>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
      {
        author: 'Alice New <alice@new>',
        date: '2024-01-02T00:00:00Z',
        files: {
          'b.txt': 'line two\n',
          '.mailmap': 'Alice New <alice@new> <alice@old>\n',
        },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    expect(report.authors).toHaveLength(1);
    expect(report.authors[0]?.email).toBe('alice@new');
  });

  it('does not apply mailmap when options.applyMailmap is false', async () => {
    const dir = buildRepo([
      {
        author: 'Alice Old <alice@old>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
      {
        author: 'Alice New <alice@new>',
        date: '2024-01-02T00:00:00Z',
        files: {
          'b.txt': 'line two\n',
          '.mailmap': 'Alice New <alice@new> <alice@old>\n',
        },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, options: { applyMailmap: false } });

    expect(report.authors).toHaveLength(2);
  });
});
