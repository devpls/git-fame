import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { summarize } from './summarize.js';
import type { Report } from '../types/report.type.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const makeReport = (overrides: Partial<Report> & { path: string }): Report => ({
  meta: {
    version: pkg.version,
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    durationMs: 100,
    cached: false,
  },
  repo: {
    path: overrides.path,
    headSha: 'a'.repeat(40),
    headRef: 'main',
    totals: { lines: 10, commits: 2, files: 3 },
  },
  authors: [],
  warnings: [],
  ...overrides,
});

describe('summarize', () => {
  it('throws on empty input', () => {
    expect(() => summarize([])).toThrow();
  });

  it('aggregates authors by email case-insensitively', () => {
    const report1 = makeReport({
      path: '/repo1',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 10,
          linesAdded: 20,
          linesDeleted: 5,
          commits: 3,
          files: 2,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
        },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      authors: [
        {
          name: 'Alice Smith',
          email: 'ALICE@EXAMPLE.COM',
          linesAlive: 5,
          linesAdded: 8,
          linesDeleted: 2,
          commits: 1,
          files: 1,
          firstCommit: new Date('2024-02-01T00:00:00Z'),
          lastCommit: new Date('2024-04-01T00:00:00Z'),
        },
      ],
    });

    const summary = summarize([report1, report2]);

    expect(summary.authors).toHaveLength(1);
    const author = summary.authors[0];
    expect(author).toBeDefined();
    expect(author!.email).toBe('alice@example.com');
    expect(author!.linesAlive).toBe(15);
    expect(author!.linesAdded).toBe(28);
    expect(author!.linesDeleted).toBe(7);
    expect(author!.commits).toBe(4);
    expect(author!.files).toBe(3);
  });

  it('uses name from record with most recent lastCommit', () => {
    const report1 = makeReport({
      path: '/repo1',
      authors: [
        {
          name: 'Alice Old Name',
          email: 'alice@example.com',
          linesAlive: 10,
          linesAdded: 20,
          linesDeleted: 5,
          commits: 3,
          files: 2,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
        },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      authors: [
        {
          name: 'Alice New Name',
          email: 'alice@example.com',
          linesAlive: 5,
          linesAdded: 8,
          linesDeleted: 2,
          commits: 1,
          files: 1,
          firstCommit: new Date('2024-02-01T00:00:00Z'),
          lastCommit: new Date('2024-05-01T00:00:00Z'),
        },
      ],
    });

    const summary = summarize([report1, report2]);

    expect(summary.authors[0]?.name).toBe('Alice New Name');
  });

  it('computes totals from repo.totals and author stats', () => {
    const report1 = makeReport({
      path: '/repo1',
      repo: {
        path: '/repo1',
        headSha: 'a'.repeat(40),
        headRef: 'main',
        totals: { lines: 100, commits: 5, files: 10 },
      },
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 60,
          linesAdded: 200,
          linesDeleted: 50,
          commits: 5,
          files: 10,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
        },
        {
          name: 'Bob',
          email: 'bob@example.com',
          linesAlive: 40,
          linesAdded: 100,
          linesDeleted: 30,
          commits: 3,
          files: 7,
          firstCommit: new Date('2024-02-01T00:00:00Z'),
          lastCommit: new Date('2024-04-01T00:00:00Z'),
        },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      repo: {
        path: '/repo2',
        headSha: 'b'.repeat(40),
        headRef: 'main',
        totals: { lines: 50, commits: 3, files: 6 },
      },
      authors: [
        {
          name: 'Bob',
          email: 'bob@example.com',
          linesAlive: 50,
          linesAdded: 80,
          linesDeleted: 20,
          commits: 3,
          files: 6,
          firstCommit: new Date('2024-03-01T00:00:00Z'),
          lastCommit: new Date('2024-05-01T00:00:00Z'),
        },
      ],
    });

    const summary = summarize([report1, report2]);

    // totals.linesAlive = sum of repo.totals.lines across reports
    expect(summary.totals.linesAlive).toBe(150);
    // totals.commits = sum of repo.totals.commits across reports
    expect(summary.totals.commits).toBe(8);
    // totals.files = sum of repo.totals.files across reports
    expect(summary.totals.files).toBe(16);
    // totals.linesAdded = sum of all authors' linesAdded across all reports
    expect(summary.totals.linesAdded).toBe(380);
    // totals.linesDeleted = sum of all authors' linesDeleted across all reports
    expect(summary.totals.linesDeleted).toBe(100);
  });

  it('sets generatedAt to max of report timestamps', () => {
    const earlier = new Date('2024-01-01T00:00:00Z');
    const later = new Date('2024-06-01T00:00:00Z');

    const report1 = makeReport({
      path: '/repo1',
      meta: { version: pkg.version, generatedAt: earlier, durationMs: 100, cached: false },
    });
    const report2 = makeReport({
      path: '/repo2',
      meta: { version: pkg.version, generatedAt: later, durationMs: 200, cached: false },
    });

    const summary = summarize([report1, report2]);

    expect(summary.meta.generatedAt).toEqual(later);
  });

  it('sets repoCount to number of reports', () => {
    const report1 = makeReport({ path: '/repo1' });
    const report2 = makeReport({ path: '/repo2' });

    const summary = summarize([report1, report2]);

    expect(summary.meta.repoCount).toBe(2);
  });

  it('uses version from version module', () => {
    const report = makeReport({ path: '/repo1' });

    const summary = summarize([report]);

    expect(summary.meta.version).toBe(pkg.version);
  });

  it('aggregates warnings with repo source', () => {
    const warning1 = { code: 'ALL_FILES_FILTERED' as const, message: 'all files filtered' };
    const warning2 = { code: 'ALL_FILES_FILTERED' as const, message: 'also filtered' };

    const report1 = makeReport({ path: '/repo1', warnings: [warning1] });
    const report2 = makeReport({ path: '/repo2', warnings: [warning2] });

    const summary = summarize([report1, report2]);

    expect(summary.warnings).toHaveLength(2);
    expect(summary.warnings[0]).toEqual({ repo: '/repo1', warning: warning1 });
    expect(summary.warnings[1]).toEqual({ repo: '/repo2', warning: warning2 });
  });

  it('aggregates breakdown entries across repos', () => {
    const report1 = makeReport({
      path: '/repo1',
      breakdown: [
        { group: 'src', linesAlive: 80, files: 10 },
        { group: 'tests', linesAlive: 20, files: 5 },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      breakdown: [
        { group: 'src', linesAlive: 40, files: 6 },
        { group: 'docs', linesAlive: 10, files: 2 },
      ],
    });

    const summary = summarize([report1, report2]);

    expect(summary.breakdown).toBeDefined();
    const src = summary.breakdown?.find((e) => e.group === 'src');
    const tests = summary.breakdown?.find((e) => e.group === 'tests');
    const docs = summary.breakdown?.find((e) => e.group === 'docs');

    expect(src).toEqual({ group: 'src', linesAlive: 120, files: 16 });
    expect(tests).toEqual({ group: 'tests', linesAlive: 20, files: 5 });
    expect(docs).toEqual({ group: 'docs', linesAlive: 10, files: 2 });
  });

  it('omits breakdown when no reports have breakdown', () => {
    const report = makeReport({ path: '/repo1' });

    const summary = summarize([report]);

    expect(summary.breakdown).toBeUndefined();
  });

  it('populates repos array from each report', () => {
    const report1 = makeReport({
      path: '/repo1',
      repo: {
        path: '/repo1',
        headSha: 'a'.repeat(40),
        headRef: 'main',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    });
    const report2 = makeReport({
      path: '/repo2',
      repo: {
        path: '/repo2',
        headSha: 'b'.repeat(40),
        headRef: 'dev',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    });

    const summary = summarize([report1, report2]);

    expect(summary.repos).toHaveLength(2);
    expect(summary.repos[0]).toEqual({ path: '/repo1', headSha: 'a'.repeat(40), headRef: 'main' });
    expect(summary.repos[1]).toEqual({ path: '/repo2', headSha: 'b'.repeat(40), headRef: 'dev' });
  });

  it('computes firstCommit and lastCommit as min/max across repos per author', () => {
    const report1 = makeReport({
      path: '/repo1',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 10,
          linesAdded: 10,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
        },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 5,
          linesAdded: 5,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: new Date('2023-06-01T00:00:00Z'),
          lastCommit: new Date('2024-05-01T00:00:00Z'),
        },
      ],
    });

    const summary = summarize([report1, report2]);
    const alice = summary.authors[0];

    expect(alice?.firstCommit).toEqual(new Date('2023-06-01T00:00:00Z'));
    expect(alice?.lastCommit).toEqual(new Date('2024-05-01T00:00:00Z'));
  });

  it('includes perRepo entries on each SummaryAuthor', () => {
    const report1 = makeReport({
      path: '/repo1',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 10,
          linesAdded: 20,
          linesDeleted: 5,
          commits: 3,
          files: 2,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
        },
      ],
    });

    const summary = summarize([report1]);
    const alice = summary.authors[0];

    expect(alice?.perRepo).toHaveLength(1);
    expect(alice?.perRepo[0]).toEqual({
      path: '/repo1',
      linesAlive: 10,
      linesAdded: 20,
      linesDeleted: 5,
      commits: 3,
      files: 2,
    });
  });

  it('aggregates author breakdown across repos', () => {
    const report1 = makeReport({
      path: '/repo1',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 10,
          linesAdded: 20,
          linesDeleted: 5,
          commits: 3,
          files: 2,
          firstCommit: new Date('2024-01-01T00:00:00Z'),
          lastCommit: new Date('2024-03-01T00:00:00Z'),
          breakdown: { src: 8, tests: 2 },
        },
      ],
    });
    const report2 = makeReport({
      path: '/repo2',
      authors: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          linesAlive: 5,
          linesAdded: 8,
          linesDeleted: 2,
          commits: 1,
          files: 1,
          firstCommit: new Date('2024-02-01T00:00:00Z'),
          lastCommit: new Date('2024-04-01T00:00:00Z'),
          breakdown: { src: 4, docs: 1 },
        },
      ],
    });

    const summary = summarize([report1, report2]);
    const alice = summary.authors[0];

    expect(alice?.breakdown).toEqual({ src: 12, tests: 2, docs: 1 });
  });
});
