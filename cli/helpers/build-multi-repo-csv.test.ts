import { describe, it, expect } from 'vitest';
import { buildMultiRepoCSV } from './build-multi-repo-csv.js';
import type { Report } from '../../src/types/report.type.js';

const makeReport = (path: string, authorName: string, email: string): Report => ({
  meta: { version: '0.2.4', generatedAt: new Date('2026-01-01'), durationMs: 100, cached: false },
  repo: { path, headSha: 'abc', headRef: 'main', totals: { lines: 100, commits: 5, files: 3 } },
  authors: [
    {
      name: authorName,
      email,
      linesAlive: 100,
      linesAdded: 120,
      linesDeleted: 20,
      commits: 5,
      files: 3,
      firstCommit: new Date('2025-01-01'),
      lastCommit: new Date('2025-12-01'),
    },
  ],
  warnings: [],
});

describe('buildMultiRepoCSV', () => {
  it('prepends repo column without --summary', () => {
    const reports = [
      makeReport('/repo1', 'Alice', 'alice@x.com'),
      makeReport('/repo2', 'Bob', 'bob@x.com'),
    ];
    const csv = buildMultiRepoCSV(reports, undefined, false);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'repo,author,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive',
    );
    expect(lines[1]).toContain('/repo1');
    expect(lines[1]).toContain('Alice');
    expect(lines[2]).toContain('/repo2');
    expect(lines[2]).toContain('Bob');
  });

  it('uses unified section schema with --summary', () => {
    const reports = [makeReport('/repo1', 'Alice', 'alice@x.com')];
    const csv = buildMultiRepoCSV(reports, undefined, true);

    expect(csv).toContain('section,author,repo');
    expect(csv).toContain('summary,');
  });

  it('quotes repo paths containing commas', () => {
    const reports = [makeReport('/path,with,commas', 'Alice', 'alice@x.com')];
    const csv = buildMultiRepoCSV(reports, undefined, false);
    const lines = csv.split('\n');

    expect(lines[1]).toContain('"/path,with,commas"');
  });
});
