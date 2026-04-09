import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { renderMarkdown } from './render-markdown.js';

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

describe('renderMarkdown', () => {
  it('contains markdown table header with separator row', () => {
    const out = renderMarkdown(makeReport());
    expect(out).toContain('| author | linesAlive |');
    expect(out).toContain('| --- |');
  });

  it('rows match report data', () => {
    const out = renderMarkdown(makeReport());
    expect(out).toContain('Alice');
    expect(out).toContain('75');
    expect(out).toContain('80');
    expect(out).toContain('25');
  });

  it('escapes angle brackets and pipes in emails and names', () => {
    const out = renderMarkdown(
      makeReport({
        authors: [
          {
            name: 'Alice | Wonderland',
            email: 'alice@example.com',
            linesAlive: 10,
            linesAdded: 10,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date('2024-01-01'),
            lastCommit: new Date('2024-01-01'),
          },
        ],
      }),
    );
    expect(out).toContain('Alice \\| Wonderland');
    expect(out).toContain('\\<alice@example.com\\>');
  });
});
