import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { renderSummaryJson } from './render-summary-json.js';

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

describe('renderSummaryJson', () => {
  it('returns valid JSON', () => {
    const out = renderSummaryJson(makeSummary());
    expect(() => JSON.parse(out) as unknown).not.toThrow();
  });

  it('includes repo count in meta', () => {
    const out = renderSummaryJson(makeSummary());
    const parsed = JSON.parse(out) as { meta: { repoCount: number } };
    expect(parsed.meta.repoCount).toBe(2);
  });

  it('includes totals', () => {
    const out = renderSummaryJson(makeSummary());
    const parsed = JSON.parse(out) as { totals: { linesAlive: number } };
    expect(parsed.totals.linesAlive).toBe(150);
  });

  it('includes author name and email', () => {
    const out = renderSummaryJson(makeSummary());
    expect(out).toContain('Alice');
    expect(out).toContain('alice@x.com');
  });

  it('includes repo paths', () => {
    const out = renderSummaryJson(makeSummary());
    expect(out).toContain('/r1');
    expect(out).toContain('/r2');
  });

  it('serializes dates as ISO strings', () => {
    const out = renderSummaryJson(makeSummary());
    expect(out).toContain('2026-01-01T00:00:00.000Z');
  });

  it('applies limit option', () => {
    const summary: Summary = {
      ...makeSummary(),
      authors: [
        ...makeSummary().authors,
        {
          name: 'Bob',
          email: 'bob@x.com',
          linesAlive: 50,
          linesAdded: 60,
          linesDeleted: 10,
          commits: 3,
          files: 2,
          firstCommit: new Date('2025-03-01'),
          lastCommit: new Date('2025-11-01'),
          perRepo: [],
        },
      ],
    };
    const out = renderSummaryJson(summary, { limit: 1 });
    const parsed = JSON.parse(out) as { authors: unknown[] };
    expect(parsed.authors).toHaveLength(1);
  });
});
