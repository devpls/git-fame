import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { renderCsv } from './render-csv.js';

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
    totals: { lines: 100, commits: 2, files: 2 },
  },
  authors: [
    {
      name: 'Alice',
      email: 'alice@example.com',
      linesAlive: 75,
      linesAdded: 80,
      linesDeleted: 5,
      commits: 1,
      files: 1,
      firstCommit: new Date('2024-01-01'),
      lastCommit: new Date('2024-01-01'),
    },
    {
      name: 'Bob',
      email: 'bob@example.com',
      linesAlive: 25,
      linesAdded: 30,
      linesDeleted: 5,
      commits: 1,
      files: 1,
      firstCommit: new Date('2024-01-02'),
      lastCommit: new Date('2024-01-02'),
    },
  ],
  warnings: [],
  ...overrides,
});

describe('renderCsv', () => {
  it('has header row with correct column names', () => {
    const out = renderCsv(makeReport());
    const header = out.split('\n')[0];
    expect(header).toBe(
      'author,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive',
    );
  });

  it('values match report data', () => {
    const out = renderCsv(makeReport());
    const lines = out.split('\n');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('75');
    expect(lines[1]).toContain('80');
    expect(lines[1]).toContain('5');
  });

  it('handles commas in names by wrapping in double quotes and escaping inner quotes', () => {
    const out = renderCsv(
      makeReport({
        authors: [
          {
            name: 'Doe, Jane "JJ"',
            email: 'jane@example.com',
            linesAlive: 10,
            linesAdded: 10,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date('2024-01-01'),
            lastCommit: new Date('2024-01-01'),
          },
        ],
      }),
    );
    const dataLine = out.split('\n')[1];
    expect(dataLine).toContain('"Doe, Jane ""JJ"" <jane@example.com>"');
  });

  it('respects sort and limit options', () => {
    const out = renderCsv(makeReport(), { sort: { by: 'linesAlive', order: 'asc' }, limit: 1 });
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Bob');
  });
});
