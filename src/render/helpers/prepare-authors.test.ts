import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { prepareAuthors } from './prepare-authors.js';

const makeReport = (overrides: Partial<Report> = {}): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    durationMs: 100,
    cached: false,
  },
  repo: {
    path: '/tmp/repo',
    headSha: 'a'.repeat(40),
    headRef: 'HEAD',
    totals: { lines: 100, commits: 11, files: 5 },
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
    },
  ],
  warnings: [],
  ...overrides,
});

describe('prepareAuthors', () => {
  it('defaults to sorting by linesAlive descending', () => {
    const result = prepareAuthors(makeReport());
    expect(result[0]?.name).toBe('Alice');
    expect(result[1]?.name).toBe('Bob');
  });

  it('sorts by commits ascending when specified', () => {
    const result = prepareAuthors(makeReport(), { sort: { by: 'commits', order: 'asc' } });
    expect(result[0]?.name).toBe('Alice');
    expect(result[1]?.name).toBe('Bob');
  });

  it('limits the number of returned authors', () => {
    const result = prepareAuthors(makeReport(), { limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Alice');
  });

  it('computes percentAlive correctly (75.0 / 25.0)', () => {
    const result = prepareAuthors(makeReport());
    expect(result[0]?.percentAlive).toBe('75.0');
    expect(result[1]?.percentAlive).toBe('25.0');
  });

  it('computes linesNet as linesAdded minus linesDeleted', () => {
    const result = prepareAuthors(makeReport());
    expect(result[0]?.linesNet).toBe(75);
    expect(result[1]?.linesNet).toBe(25);
  });

  it('returns an empty array when report has no authors', () => {
    const result = prepareAuthors(makeReport({ authors: [] }));
    expect(result).toHaveLength(0);
  });

  it('returns percentAlive as "0.0" when total linesAlive is zero', () => {
    const result = prepareAuthors(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            linesAlive: 0,
            linesAdded: 0,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date('2024-01-01T00:00:00Z'),
            lastCommit: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      }),
    );
    expect(result[0]?.percentAlive).toBe('0.0');
  });

  it('sort order defaults to desc when only sort.by is provided', () => {
    const result = prepareAuthors(makeReport(), { sort: { by: 'commits' } });
    expect(result[0]?.name).toBe('Bob');
    expect(result[1]?.name).toBe('Alice');
  });

  it('preserves breakdown when present on source author', () => {
    const breakdown = { ts: 40, js: 10 };
    const report = makeReport({
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
        },
      ],
    });
    const result = prepareAuthors(report);
    expect(result[0]?.breakdown).toEqual(breakdown);
  });

  it('omits breakdown when not present on source author', () => {
    const result = prepareAuthors(makeReport());
    expect(result[0]?.breakdown).toBeUndefined();
  });
});
