import { describe, expect, it } from 'vitest';
import type { Report } from '../types/report.type.js';
import type { Summary } from '../types/summary.type.js';
import { render } from './render.js';

const makeSummary = (): Summary => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date(0),
    repoCount: 2,
  },
  repos: [
    { path: '/tmp/repo-a', headSha: 'a'.repeat(40), headRef: 'HEAD' },
    { path: '/tmp/repo-b', headSha: 'b'.repeat(40), headRef: 'HEAD' },
  ],
  totals: { linesAlive: 0, linesAdded: 0, linesDeleted: 0, commits: 0, files: 0 },
  authors: [],
  warnings: [],
});

const emptyReport = (): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date(0),
    durationMs: 0,
    cached: false,
  },
  repo: {
    path: '/tmp/repo',
    headSha: 'a'.repeat(40),
    headRef: 'HEAD',
    totals: { lines: 0, commits: 0, files: 0 },
  },
  authors: [],
  warnings: [],
});

describe('render', () => {
  it('delegates the "table" format to renderTable', () => {
    const out = render(emptyReport(), 'table');
    expect(typeof out).toBe('string');
    expect(out).toContain('author');
  });

  it('throws for an unknown format', () => {
    // @ts-expect-error — deliberately passing an invalid format to test runtime guard
    expect(() => render(emptyReport(), 'yaml')).toThrow(/unsupported format/i);
  });

  it('delegates "json" format to renderJson', () => {
    const out = render(emptyReport(), 'json');
    expect(() => JSON.parse(out) as unknown).not.toThrow();
  });

  it('delegates "csv" format to renderCsv', () => {
    const out = render(emptyReport(), 'csv');
    expect(out).toContain('author,');
  });

  it('delegates "markdown" format to renderMarkdown', () => {
    const out = render(emptyReport(), 'markdown');
    expect(out).toContain('| --- |');
  });

  it('passes RenderOptions through to the format renderer', () => {
    // Create a report with 2 authors, limit to 1
    const report = {
      ...emptyReport(),
      authors: [
        {
          name: 'Alice',
          email: 'a@x',
          linesAlive: 100,
          linesAdded: 100,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: new Date(0),
          lastCommit: new Date(0),
        },
        {
          name: 'Bob',
          email: 'b@x',
          linesAlive: 50,
          linesAdded: 50,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: new Date(0),
          lastCommit: new Date(0),
        },
      ],
    };
    const out = render(report, 'json', { limit: 1 });
    const parsed = JSON.parse(out) as { authors: unknown[] };
    expect(parsed.authors).toHaveLength(1);
  });
});

describe('render — Summary dispatch', () => {
  it('delegates "table" format to renderSummaryTable', () => {
    const out = render(makeSummary(), 'table');
    expect(out).toContain('Summary');
  });

  it('delegates "json" format to renderSummaryJson', () => {
    const out = render(makeSummary(), 'json');
    expect(() => JSON.parse(out) as unknown).not.toThrow();
  });

  it('delegates "csv" format to renderSummaryCsv', () => {
    const out = render(makeSummary(), 'csv');
    expect(out).toContain('section,author');
  });

  it('delegates "markdown" format to renderSummaryMarkdown', () => {
    const out = render(makeSummary(), 'markdown');
    expect(out).toContain('## Summary');
  });

  it('throws for an unknown format when given a Summary', () => {
    // @ts-expect-error — deliberately passing an invalid format to test runtime guard
    expect(() => render(makeSummary(), 'yaml')).toThrow(/unsupported format/i);
  });
});
