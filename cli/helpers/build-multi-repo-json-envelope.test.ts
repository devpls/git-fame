import { describe, it, expect } from 'vitest';
import { buildMultiRepoJsonEnvelope } from './build-multi-repo-json-envelope.js';
import type { Report } from '../../src/types/report.type.js';

const makeReport = (path: string): Report => ({
  meta: { version: '0.2.4', generatedAt: new Date('2026-01-01'), durationMs: 100, cached: false },
  repo: { path, headSha: 'abc', headRef: 'main', totals: { lines: 100, commits: 5, files: 3 } },
  authors: [
    {
      name: 'Alice',
      email: 'alice@x.com',
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

const NOW = new Date('2026-04-28T12:00:00.000Z');

describe('buildMultiRepoJsonEnvelope', () => {
  it('produces envelope with meta and reports array', () => {
    const reports = [makeReport('/repo1'), makeReport('/repo2')];
    const json = buildMultiRepoJsonEnvelope(reports, undefined, false, NOW);
    const parsed = JSON.parse(json) as {
      meta: { version: string; repoCount: number; generatedAt: string };
      reports: unknown[];
    };

    expect(parsed.meta.version).toBe('0.2.4');
    expect(parsed.meta.repoCount).toBe(2);
    expect(parsed.meta.generatedAt).toBe('2026-04-28T12:00:00.000Z');
    expect(parsed.reports).toHaveLength(2);
    expect(parsed).not.toHaveProperty('summary');
  });

  it('includes summary when doSummary is true', () => {
    const reports = [makeReport('/repo1')];
    const json = buildMultiRepoJsonEnvelope(reports, undefined, true, NOW);
    const parsed = JSON.parse(json) as { summary: { authors: unknown[] } };

    expect(parsed).toHaveProperty('summary');
    expect(parsed.summary.authors).toHaveLength(1);
  });

  it('throws on empty reports', () => {
    expect(() => buildMultiRepoJsonEnvelope([], undefined, false, NOW)).toThrow('non-empty');
  });

  it('serializes dates as ISO strings', () => {
    const reports = [makeReport('/repo1')];
    const json = buildMultiRepoJsonEnvelope(reports, undefined, false, NOW);

    expect(json).toContain('2026-04-28T12:00:00.000Z');
  });
});
