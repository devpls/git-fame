import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { renderSummaryCsv } from './render-summary-csv.js';

const makeSummary = (): Summary => ({
  meta: { version: '0.2.4', generatedAt: new Date('2026-01-01'), repoCount: 2 },
  repos: [
    { path: '/r1', headSha: 'a'.repeat(40), headRef: 'main' },
    { path: '/r2', headSha: 'b'.repeat(40), headRef: 'main' },
  ],
  totals: { linesAlive: 150, linesAdded: 200, linesDeleted: 50, commits: 10, files: 6 },
  authors: [
    {
      name: 'Alice',
      email: 'alice@x.com',
      linesAlive: 150,
      linesAdded: 200,
      linesDeleted: 50,
      commits: 10,
      files: 6,
      firstCommit: new Date('2025-01-01'),
      lastCommit: new Date('2025-12-01'),
      perRepo: [
        { path: '/r1', linesAlive: 100, linesAdded: 130, linesDeleted: 30, commits: 7, files: 4 },
        { path: '/r2', linesAlive: 50, linesAdded: 70, linesDeleted: 20, commits: 3, files: 2 },
      ],
    },
  ],
  warnings: [],
});

describe('renderSummaryCsv', () => {
  it('starts with the expected header', () => {
    const out = renderSummaryCsv(makeSummary());
    const firstLine = out.split('\n')[0];
    expect(firstLine).toBe(
      'section,author,repo,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive',
    );
  });

  it('includes a summary row for each author', () => {
    const out = renderSummaryCsv(makeSummary());
    const lines = out.split('\n');
    const summaryLines = lines.filter((l) => l.startsWith('summary,'));
    expect(summaryLines).toHaveLength(1);
  });

  it('includes detail rows for each author per-repo entry', () => {
    const out = renderSummaryCsv(makeSummary());
    const lines = out.split('\n');
    const detailLines = lines.filter((l) => l.startsWith('detail,'));
    expect(detailLines).toHaveLength(2);
  });

  it('includes author name in summary row', () => {
    const out = renderSummaryCsv(makeSummary());
    expect(out).toContain('Alice');
    expect(out).toContain('alice@x.com');
  });

  it('includes repo paths in detail rows', () => {
    const out = renderSummaryCsv(makeSummary());
    expect(out).toContain('/r1');
    expect(out).toContain('/r2');
  });

  it('summary row has empty repo field and percentAlive value', () => {
    const out = renderSummaryCsv(makeSummary());
    const summaryLine = out.split('\n').find((l) => l.startsWith('summary,'));
    expect(summaryLine).toBeDefined();
    expect(summaryLine).toContain('100.0');
  });

  it('detail row has empty percentAlive field', () => {
    const out = renderSummaryCsv(makeSummary());
    const detailLine = out.split('\n').find((l) => l.startsWith('detail,') && l.includes('/r1'));
    expect(detailLine).toBeDefined();
    expect(detailLine).toMatch(/,$/);
  });

  it('quotes author names containing commas', () => {
    const summary: Summary = {
      ...makeSummary(),
      authors: [
        {
          name: 'Last, First',
          email: 'lf@x.com',
          linesAlive: 10,
          linesAdded: 10,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: new Date('2025-01-01'),
          lastCommit: new Date('2025-12-01'),
          perRepo: [],
        },
      ],
    };
    const out = renderSummaryCsv(summary);
    expect(out).toContain('"Last, First <lf@x.com>"');
  });
});
