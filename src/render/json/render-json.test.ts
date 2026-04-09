import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { renderJson } from './render-json.js';

const makeReport = (overrides: Partial<Report> = {}): Report => ({
  meta: { version: '0.1.0', generatedAt: new Date('2024-01-01T00:00:00Z'), durationMs: 100 },
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

describe('renderJson', () => {
  it('returns valid parseable JSON', () => {
    const out = renderJson(makeReport());
    const parsed: unknown = JSON.parse(out);
    expect(parsed).toBeTruthy();
  });

  it('authors sorted by linesAlive descending by default', () => {
    const out = renderJson(makeReport());
    const parsed = JSON.parse(out) as { authors: { name: string }[] };
    expect(parsed.authors[0]?.name).toBe('Alice');
    expect(parsed.authors[1]?.name).toBe('Bob');
  });

  it('respects the limit option', () => {
    const out = renderJson(makeReport(), { limit: 1 });
    const parsed = JSON.parse(out) as { authors: unknown[] };
    expect(parsed.authors).toHaveLength(1);
  });

  it('includes meta.version and repo.path', () => {
    const out = renderJson(makeReport());
    const parsed = JSON.parse(out) as { meta: { version: string }; repo: { path: string } };
    expect(parsed.meta.version).toBe('0.1.0');
    expect(parsed.repo.path).toBe('/tmp/repo');
  });
});
