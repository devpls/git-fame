import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { prepareSummaryAuthors } from './prepare-summary-authors.js';

const makeSummary = (overrides: Partial<Summary> = {}): Summary => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    repoCount: 2,
  },
  repos: [
    { path: '/tmp/repo-a', headSha: 'a'.repeat(40), headRef: 'HEAD' },
    { path: '/tmp/repo-b', headSha: 'b'.repeat(40), headRef: 'HEAD' },
  ],
  totals: {
    linesAlive: 100,
    linesAdded: 110,
    linesDeleted: 10,
    commits: 11,
    files: 5,
  },
  authors: [
    {
      name: 'Alice',
      email: 'alice@example.com',
      linesAlive: 75,
      linesAdded: 80,
      linesDeleted: 5,
      commits: 1,
      files: 3,
      firstCommit: new Date('2024-01-01T00:00:00Z'),
      lastCommit: new Date('2024-01-02T00:00:00Z'),
      perRepo: [
        {
          path: '/tmp/repo-a',
          linesAlive: 50,
          linesAdded: 55,
          linesDeleted: 5,
          commits: 1,
          files: 2,
        },
        {
          path: '/tmp/repo-b',
          linesAlive: 25,
          linesAdded: 25,
          linesDeleted: 0,
          commits: 0,
          files: 1,
        },
      ],
    },
    {
      name: 'Bob',
      email: 'bob@example.com',
      linesAlive: 25,
      linesAdded: 30,
      linesDeleted: 5,
      commits: 10,
      files: 2,
      firstCommit: new Date('2024-01-01T00:00:00Z'),
      lastCommit: new Date('2024-01-03T00:00:00Z'),
      perRepo: [
        {
          path: '/tmp/repo-a',
          linesAlive: 25,
          linesAdded: 30,
          linesDeleted: 5,
          commits: 10,
          files: 2,
        },
      ],
    },
  ],
  warnings: [],
  ...overrides,
});

describe('prepareSummaryAuthors', () => {
  it('computes linesNet as linesAdded minus linesDeleted', () => {
    const result = prepareSummaryAuthors(makeSummary());
    expect(result[0]?.linesNet).toBe(75);
    expect(result[1]?.linesNet).toBe(25);
  });

  it('computes percentAlive relative to summary totals.linesAlive', () => {
    const result = prepareSummaryAuthors(makeSummary());
    expect(result[0]?.percentAlive).toBe('75.0');
    expect(result[1]?.percentAlive).toBe('25.0');
  });

  it('returns percentAlive as "0.0" when totals.linesAlive is zero', () => {
    const summary = makeSummary({
      totals: { linesAlive: 0, linesAdded: 0, linesDeleted: 0, commits: 0, files: 0 },
    });
    const result = prepareSummaryAuthors(summary);
    expect(result[0]?.percentAlive).toBe('0.0');
  });

  it('defaults to sorting by linesAlive descending', () => {
    const result = prepareSummaryAuthors(makeSummary());
    expect(result[0]?.name).toBe('Alice');
    expect(result[1]?.name).toBe('Bob');
  });

  it('sorts by commits descending when specified', () => {
    const result = prepareSummaryAuthors(makeSummary(), { sort: { by: 'commits' } });
    expect(result[0]?.name).toBe('Bob');
    expect(result[1]?.name).toBe('Alice');
  });

  it('sorts by commits ascending when specified', () => {
    const result = prepareSummaryAuthors(makeSummary(), { sort: { by: 'commits', order: 'asc' } });
    expect(result[0]?.name).toBe('Alice');
    expect(result[1]?.name).toBe('Bob');
  });

  it('sorts by lastCommit descending', () => {
    const result = prepareSummaryAuthors(makeSummary(), { sort: { by: 'lastCommit' } });
    expect(result[0]?.name).toBe('Bob');
    expect(result[1]?.name).toBe('Alice');
  });

  it('applies limit to the result', () => {
    const result = prepareSummaryAuthors(makeSummary(), { limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Alice');
  });

  it('preserves perRepo as-is on each author', () => {
    const summary = makeSummary();
    const result = prepareSummaryAuthors(summary);
    expect(result[0]?.perRepo).toBe(summary.authors[0]?.perRepo);
    expect(result[1]?.perRepo).toBe(summary.authors[1]?.perRepo);
  });

  it('includes breakdown when present on source author', () => {
    const breakdown = { ts: 60, js: 15 };
    const summary = makeSummary({
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 75,
          linesAdded: 80,
          linesDeleted: 5,
          commits: 1,
          files: 3,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-01-02T00:00:00Z'),
          breakdown,
          perRepo: [],
        },
      ],
    });
    const result = prepareSummaryAuthors(summary);
    expect(result[0]?.breakdown).toEqual(breakdown);
  });

  it('omits breakdown when not present on source author', () => {
    const result = prepareSummaryAuthors(makeSummary());
    expect(result[0]?.breakdown).toBeUndefined();
  });

  it('returns an empty array when summary has no authors', () => {
    const result = prepareSummaryAuthors(makeSummary({ authors: [] }));
    expect(result).toHaveLength(0);
  });
});
