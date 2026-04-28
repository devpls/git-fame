import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { renderSummaryTable } from './render-summary-table.js';

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

describe('renderSummaryTable', () => {
  it('includes the repo count in the header', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('=== Summary (2 repos) ===');
  });

  it('includes totals line with lines, commits, and files', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('150 lines');
    expect(out).toContain('10 commits');
    expect(out).toContain('6 files');
  });

  it('includes author name in the main table', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('Alice');
    expect(out).toContain('alice@x.com');
  });

  it('includes per-repo paths in the detail table', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('/r1');
    expect(out).toContain('/r2');
  });

  it('includes per-repo breakdown section header', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('Per-repo breakdown:');
  });

  it('includes column headers in the main table', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('Author');
    expect(out).toContain('Lines');
    expect(out).toContain('% Alive');
  });

  it('includes percentAlive with % suffix', () => {
    const out = renderSummaryTable(makeSummary());
    expect(out).toContain('100.0%');
  });
});
