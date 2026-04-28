import { describe, expect, it } from 'vitest';
import type { Summary } from '../../types/summary.type.js';
import { buildSummaryDto } from './build-summary-dto.js';

const makeSummary = (overrides: Partial<Summary> = {}): Summary => ({
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
      linesAlive: 100,
      linesAdded: 130,
      linesDeleted: 30,
      commits: 7,
      files: 4,
      firstCommit: new Date('2025-01-01'),
      lastCommit: new Date('2025-12-01'),
      perRepo: [
        { path: '/r1', linesAlive: 60, linesAdded: 80, linesDeleted: 20, commits: 5, files: 3 },
        { path: '/r2', linesAlive: 40, linesAdded: 50, linesDeleted: 10, commits: 2, files: 1 },
      ],
    },
    {
      name: 'Bob',
      email: 'bob@x.com',
      linesAlive: 50,
      linesAdded: 70,
      linesDeleted: 20,
      commits: 3,
      files: 2,
      firstCommit: new Date('2025-03-01'),
      lastCommit: new Date('2025-11-01'),
      perRepo: [
        { path: '/r1', linesAlive: 50, linesAdded: 70, linesDeleted: 20, commits: 3, files: 2 },
      ],
    },
  ],
  warnings: [],
  ...overrides,
});

describe('buildSummaryDto', () => {
  it('returns DTO with meta, repos, totals, prepared authors, and warnings', () => {
    const summary = makeSummary();
    const dto = buildSummaryDto(summary);

    expect(dto.meta.version).toBe('0.2.4');
    expect(dto.meta.repoCount).toBe(2);
    expect(dto.repos).toHaveLength(2);
    expect(dto.totals.linesAlive).toBe(150);
    expect(dto.authors).toHaveLength(2);
    expect(dto.warnings).toEqual([]);
  });

  it('applies sort option', () => {
    const dto = buildSummaryDto(makeSummary(), { sort: { by: 'commits', order: 'desc' } });

    expect(dto.authors[0]?.name).toBe('Alice');
    expect(dto.authors[1]?.name).toBe('Bob');
  });

  it('applies limit option', () => {
    const dto = buildSummaryDto(makeSummary(), { limit: 1 });

    expect(dto.authors).toHaveLength(1);
    expect(dto.authors[0]?.name).toBe('Alice');
  });

  it('includes breakdown when present on summary', () => {
    const breakdown = [
      { group: 'src', linesAlive: 120, files: 5 },
      { group: 'tests', linesAlive: 30, files: 1 },
    ];
    const dto = buildSummaryDto(makeSummary({ breakdown }));

    expect(dto.breakdown).toEqual(breakdown);
  });

  it('omits breakdown when not present on summary', () => {
    const dto = buildSummaryDto(makeSummary());
    expect(dto.breakdown).toBeUndefined();
  });

  it('passes warnings through to the DTO', () => {
    const warnings = [
      { repo: '/r1', warning: { code: 'ALL_FILES_FILTERED' as const, message: 'test' } },
    ];
    const dto = buildSummaryDto(makeSummary({ warnings }));

    expect(dto.warnings).toEqual(warnings);
  });
});
