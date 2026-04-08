import { describe, expect, it } from 'vitest';
import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { Warning } from '../../../types/warning.type.js';
import { Aggregator } from './aggregator.js';

const makeLogCommit = (overrides: Partial<LogCommit> = {}): LogCommit => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  files: [],
  ...overrides,
});

const makeBlameLine = (overrides: Partial<BlameLine> = {}): BlameLine => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  line: 'code',
  isBoundary: false,
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

describe('Aggregator.recordBlameLine', () => {
  it('increments linesAlive for an existing author', () => {
    const agg = new Aggregator();
    agg.recordCommit(makeLogCommit({ files: [{ path: 'a.txt', added: 10, deleted: 0 }] }));
    agg.recordBlameLine(makeBlameLine());
    agg.recordBlameLine(makeBlameLine());
    agg.recordBlameLine(makeBlameLine());

    expect(agg.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(3);
  });

  it('creates a new author when the first signal is a blame line', () => {
    const agg = new Aggregator();
    agg.recordBlameLine(makeBlameLine({ authorMail: 'new@x', authorName: 'New' }));
    const stats = agg.getStatsForTesting().get('new@x');
    expect(stats?.linesAlive).toBe(1);
    expect(stats?.name).toBe('New');
    expect(stats?.commits).toBe(0);
  });
});

describe('Aggregator.recordWarning', () => {
  it('appends warnings in insertion order', () => {
    const agg = new Aggregator();
    const w1: Warning = { code: 'FILE_SKIPPED_BINARY', file: 'a.png', message: 'binary file' };
    const w2: Warning = {
      code: 'BLAME_FAILED',
      file: 'b.txt',
      error: 'no such path',
      message: 'blame failed',
    };
    agg.recordWarning(w1);
    agg.recordWarning(w2);

    expect(agg.getWarningsForTesting()).toEqual([w1, w2]);
  });
});

describe('Aggregator.build', () => {
  it('produces a Report with totals and finalised author stats', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ path: 'a.txt', added: 10, deleted: 2 }],
      }),
    );
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@example.com' }));
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@example.com' }));

    const report = agg.build(
      {
        version: '0.1.0',
        generatedAt: new Date('2024-02-01T00:00:00Z'),
        durationMs: 42,
      },
      {
        path: '/tmp/repo',
        headSha: 'b'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );

    expect(report.meta.version).toBe('0.1.0');
    expect(report.meta.durationMs).toBe(42);
    expect(report.repo.path).toBe('/tmp/repo');
    expect(report.repo.totals.lines).toBe(2);
    expect(report.repo.totals.commits).toBe(1);
    expect(report.repo.totals.files).toBe(1);
    expect(report.authors).toHaveLength(1);
    expect(report.authors[0]?.email).toBe('alice@example.com');
    expect(report.authors[0]?.linesAlive).toBe(2);
    expect(report.authors[0]?.linesAdded).toBe(10);
    expect(report.authors[0]?.linesDeleted).toBe(2);
    expect(report.authors[0]?.commits).toBe(1);
    expect(report.authors[0]?.files).toBe(1);
    expect(report.authors[0]?.firstCommit?.getTime()).toBe(1704067200 * 1000);
    expect(report.authors[0]?.lastCommit?.getTime()).toBe(1704067200 * 1000);
  });

  it('collects warnings into the built report', () => {
    const agg = new Aggregator();
    agg.recordWarning({ code: 'FILE_SKIPPED_BINARY', file: 'x.png', message: 'skipped' });
    const report = agg.build(
      { version: '0.1.0', generatedAt: new Date(0), durationMs: 0 },
      {
        path: '/tmp/repo',
        headSha: 'x'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.code).toBe('FILE_SKIPPED_BINARY');
  });

  it('produces authors with Date objects even when only blame lines were recorded', () => {
    const agg = new Aggregator();
    agg.recordBlameLine(makeBlameLine({ authorMail: 'a@x', authorTime: 1700000000 }));
    const report = agg.build(
      { version: '0.1.0', generatedAt: new Date(0), durationMs: 0 },
      {
        path: '/tmp/repo',
        headSha: 'x'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );
    expect(report.authors[0]?.firstCommit).toBeInstanceOf(Date);
    expect(report.authors[0]?.lastCommit).toBeInstanceOf(Date);
  });
});
