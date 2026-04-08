import { rmSync } from 'node:fs';
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
});
