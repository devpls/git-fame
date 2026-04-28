import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { renderSummaryMarkdown } from './render-summary-markdown.js';

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

describe('renderSummaryMarkdown', () => {
  it('starts with the summary header including repo count', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('## Summary (2 repos)');
  });

  it('includes the totals line', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('150 lines');
    expect(out).toContain('10 commits');
    expect(out).toContain('6 files');
  });

  it('includes main table column headers', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('| Author |');
    expect(out).toContain('Lines');
    expect(out).toContain('% Alive');
  });

  it('includes the per-repo breakdown sub-header', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('### Per-repo breakdown');
  });

  it('includes author with escaped angle brackets', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('Alice \\<alice@x.com\\>');
  });

  it('includes repo paths in the detail table', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('/r1');
    expect(out).toContain('/r2');
  });

  it('includes detail table column headers', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('| Repo |');
  });

  it('includes separator rows for tables', () => {
    const out = renderSummaryMarkdown(makeSummary());
    expect(out).toContain('| --- |');
  });
});
