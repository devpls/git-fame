import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { runBlamePhase } from './run-blame-phase.js';

describe('runBlamePhase', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('records linesAlive for every blame line across files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\nthree\n', 'b.txt': 'single\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'b.txt'], agg);

    const stats = agg.getStatsForTesting().get('a@x');
    expect(stats?.linesAlive).toBe(4);
  });

  it('attributes lines to the current owner after a rewrite', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt'], agg);

    const stats = agg.getStatsForTesting();
    expect(stats.get('a@x')?.linesAlive).toBe(1);
    expect(stats.get('b@x')?.linesAlive).toBe(1);
  });

  it('emits BLAME_FAILED warning for missing files without throwing', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'does-not-exist.txt'], agg);

    expect(agg.getStatsForTesting().get('a@x')?.linesAlive).toBe(1);
    const warnings = agg.getWarningsForTesting();
    expect(warnings.some((w) => w.code === 'BLAME_FAILED')).toBe(true);
  });

  it('is a no-op when the file list is empty', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, [], agg);
    expect(agg.getStatsForTesting().size).toBe(0);
  });
});
