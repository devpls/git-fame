import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { runLogPhase } from './run-log-phase.js';

describe('runLogPhase', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('feeds all commits into the aggregator', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'x\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runLogPhase(dir, agg);

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(2);
    expect(stats.get('a@x')?.linesAdded).toBe(2);
    expect(stats.get('a@x')?.commits).toBe(1);
    expect(stats.get('b@x')?.linesAdded).toBe(1);
    expect(stats.get('b@x')?.commits).toBe(1);
  });

  it('is a no-op on an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const agg = new Aggregator();
    await runLogPhase(dir, agg);
    expect(agg.getStatsForTesting().size).toBe(0);
  });

  it('filters commits by since date', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'old\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-06-01T00:00:00Z',
        files: { 'b.txt': 'new\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runLogPhase(dir, agg, { since: new Date('2024-03-01T00:00:00Z') });

    const stats = agg.getStatsForTesting();
    // Only Bob's commit is after March; Alice's is filtered out
    expect(stats.has('a@x')).toBe(false);
    expect(stats.get('b@x')?.commits).toBe(1);
  });

  it('filters commits by range', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'first\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'middle\n' },
      },
      {
        author: 'Carol <c@x>',
        date: '2024-01-03T00:00:00Z',
        files: { 'c.txt': 'last\n' },
      },
    ]);
    createdRepos.push(dir);

    // Tag the first and second commits
    const logResult = spawnSync('git', ['log', '--format=%H', '--reverse'], {
      cwd: dir,
      encoding: 'utf8',
    });
    const shas = logResult.stdout.trim().split('\n');
    const fromSha = shas[0] ?? '';
    const toSha = shas[1] ?? '';

    const agg = new Aggregator();
    await runLogPhase(dir, agg, { range: { fromSha, toSha } });

    const stats = agg.getStatsForTesting();
    // Only Bob's commit is in range (fromSha..toSha excludes fromSha itself)
    expect(stats.has('a@x')).toBe(false);
    expect(stats.get('b@x')?.commits).toBe(1);
    expect(stats.has('c@x')).toBe(false);
  });
});
