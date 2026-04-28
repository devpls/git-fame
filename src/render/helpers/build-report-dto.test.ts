import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { buildReportDto } from './build-report-dto.js';

const makeReport = (overrides: Partial<Report> = {}): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    durationMs: 42,
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
      firstCommit: new Date('2024-01-01T00:00:00Z'),
      lastCommit: new Date('2024-01-02T00:00:00Z'),
    },
    {
      name: 'Bob',
      email: 'bob@example.com',
      linesAlive: 25,
      linesAdded: 30,
      linesDeleted: 5,
      commits: 5,
      files: 1,
      firstCommit: new Date('2024-01-01T00:00:00Z'),
      lastCommit: new Date('2024-01-03T00:00:00Z'),
    },
  ],
  warnings: [],
  ...overrides,
});

describe('buildReportDto', () => {
  it('returns DTO with meta, repo, prepared authors, and warnings', () => {
    const report = makeReport();
    const dto = buildReportDto(report);

    expect(dto.meta.version).toBe('0.1.0');
    expect(dto.meta.generatedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    expect(dto.meta.durationMs).toBe(42);
    expect(dto.repo.path).toBe('/tmp/repo');
    expect(dto.authors).toHaveLength(2);
    expect(dto.warnings).toEqual([]);
  });

  it('applies sort option from options', () => {
    const report = makeReport();
    const dto = buildReportDto(report, { sort: { by: 'commits', order: 'desc' } });

    expect(dto.authors[0]?.name).toBe('Bob');
    expect(dto.authors[1]?.name).toBe('Alice');
  });

  it('applies limit option from options', () => {
    const report = makeReport();
    const dto = buildReportDto(report, { limit: 1 });

    expect(dto.authors).toHaveLength(1);
    expect(dto.authors[0]?.name).toBe('Alice');
  });

  it('includes breakdown when present on report', () => {
    const breakdown = [
      { group: 'src', linesAlive: 80, files: 4 },
      { group: 'tests', linesAlive: 20, files: 1 },
    ];
    const report = makeReport({ breakdown });
    const dto = buildReportDto(report);

    expect(dto.breakdown).toEqual(breakdown);
  });

  it('omits breakdown when not present on report', () => {
    const dto = buildReportDto(makeReport());
    expect(dto.breakdown).toBeUndefined();
  });

  it('passes warnings through to the DTO', () => {
    const warnings = [{ code: 'ALL_FILES_FILTERED' as const, message: 'test' }];
    const report = makeReport({ warnings });
    const dto = buildReportDto(report);

    expect(dto.warnings).toEqual(warnings);
  });
});
