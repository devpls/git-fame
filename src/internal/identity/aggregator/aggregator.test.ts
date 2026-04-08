import { describe, expect, it } from 'vitest';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import { Aggregator } from './aggregator.js';

const makeLogCommit = (overrides: Partial<LogCommit> = {}): LogCommit => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  files: [],
  ...overrides,
});

describe('Aggregator.recordCommit', () => {
  it('creates a new author entry on first commit', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        files: [{ path: 'a.txt', added: 10, deleted: 0 }],
      }),
    );

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(1);
    const alice = stats.get('alice@example.com');
    expect(alice?.name).toBe('Alice');
    expect(alice?.linesAdded).toBe(10);
    expect(alice?.linesDeleted).toBe(0);
    expect(alice?.commits).toBe(1);
    expect(alice?.filesSet.has('a.txt')).toBe(true);
    expect(alice?.firstCommitTime).toBe(1704067200);
    expect(alice?.lastCommitTime).toBe(1704067200);
  });

  it('sums added and deleted across multiple files in one commit', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        files: [
          { path: 'a.txt', added: 5, deleted: 0 },
          { path: 'b.txt', added: 3, deleted: 2 },
        ],
      }),
    );

    const alice = agg.getStatsForTesting().get('alice@example.com');
    expect(alice?.linesAdded).toBe(8);
    expect(alice?.linesDeleted).toBe(2);
    expect(alice?.filesSet.size).toBe(2);
  });

  it('accumulates commits across multiple commits from the same author', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorTime: 1704067200,
        files: [{ path: 'a.txt', added: 1, deleted: 0 }],
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorTime: 1704153600,
        files: [{ path: 'b.txt', added: 2, deleted: 0 }],
      }),
    );

    const alice = agg.getStatsForTesting().get('alice@example.com');
    expect(alice?.commits).toBe(2);
    expect(alice?.linesAdded).toBe(3);
    expect(alice?.filesSet.size).toBe(2);
    expect(alice?.firstCommitTime).toBe(1704067200);
    expect(alice?.lastCommitTime).toBe(1704153600);
  });

  it('tracks two different authors separately', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        files: [{ path: 'a.txt', added: 1, deleted: 0 }],
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        files: [{ path: 'b.txt', added: 2, deleted: 0 }],
      }),
    );

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(2);
    expect(stats.get('alice@example.com')?.linesAdded).toBe(1);
    expect(stats.get('bob@example.com')?.linesAdded).toBe(2);
  });

  it('updates name to the most recent for the same email', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'a@x',
        authorTime: 1704067200,
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice Smith',
        authorMail: 'a@x',
        authorTime: 1704153600,
      }),
    );
    expect(agg.getStatsForTesting().get('a@x')?.name).toBe('Alice Smith');
  });
});
