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
});
