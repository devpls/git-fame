import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { renderTable } from './render-table.js';

const makeReport = (overrides: Partial<Report> = {}): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    durationMs: 100,
  },
  repo: {
    path: '/tmp/repo',
    headSha: 'a'.repeat(40),
    headRef: 'HEAD',
    totals: { lines: 0, commits: 0, files: 0 },
  },
  authors: [],
  warnings: [],
  ...overrides,
});

describe('renderTable', () => {
  it('returns a non-empty string for an empty report', () => {
    const out = renderTable(makeReport());
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('lists authors sorted by linesAlive descending', () => {
    const out = renderTable(
      makeReport({
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
            lastCommit: new Date('2024-01-01T00:00:00Z'),
          },
          {
            name: 'Bob',
            email: 'bob@example.com',
            linesAlive: 100,
            linesAdded: 100,
            linesDeleted: 0,
            commits: 2,
            files: 2,
            firstCommit: new Date('2024-01-02T00:00:00Z'),
            lastCommit: new Date('2024-01-02T00:00:00Z'),
          },
        ],
      }),
    );
    const bobIndex = out.indexOf('Bob');
    const aliceIndex = out.indexOf('Alice');
    expect(bobIndex).toBeGreaterThan(-1);
    expect(aliceIndex).toBeGreaterThan(-1);
    expect(bobIndex).toBeLessThan(aliceIndex);
  });

  it('includes the author name and all numeric columns in the output', () => {
    const out = renderTable(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            linesAlive: 42,
            linesAdded: 50,
            linesDeleted: 8,
            commits: 3,
            files: 4,
            firstCommit: new Date('2024-01-01T00:00:00Z'),
            lastCommit: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      }),
    );
    expect(out).toContain('Alice');
    expect(out).toContain('42');
    expect(out).toContain('50');
    expect(out).toContain('8');
    expect(out).toContain('3');
    expect(out).toContain('4');
  });

  it('renders the header with column names', () => {
    const out = renderTable(makeReport());
    expect(out).toContain('author');
    expect(out).toContain('linesAlive');
    expect(out).toContain('linesAdded');
  });

  it('computes percentAlive against the total of all authors', () => {
    const out = renderTable(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'a@x',
            linesAlive: 75,
            linesAdded: 75,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date(0),
            lastCommit: new Date(0),
          },
          {
            name: 'Bob',
            email: 'b@x',
            linesAlive: 25,
            linesAdded: 25,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date(0),
            lastCommit: new Date(0),
          },
        ],
      }),
    );
    expect(out).toContain('75.0');
    expect(out).toContain('25.0');
  });
});
