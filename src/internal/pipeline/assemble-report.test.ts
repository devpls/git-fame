import { describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { assembleReport } from './assemble-report.js';

describe('assembleReport', () => {
  it('builds a report from an aggregator with the supplied meta and repo fields', () => {
    const agg = new Aggregator();
    const start = new Date('2024-02-01T00:00:00Z');
    const report = assembleReport(agg, {
      path: '/tmp/repo',
      headSha: 'a'.repeat(40),
      headRef: 'HEAD',
      startedAt: start,
      durationMs: 123,
    });

    expect(report.meta.version).toBe('0.1.0');
    expect(report.meta.generatedAt).toEqual(start);
    expect(report.meta.durationMs).toBe(123);
    expect(report.repo.path).toBe('/tmp/repo');
    expect(report.repo.headSha).toBe('a'.repeat(40));
    expect(report.repo.headRef).toBe('HEAD');
    expect(report.repo.totals).toEqual({ lines: 0, commits: 0, files: 0 });
    expect(report.authors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});
