import { describe, expect, it } from 'vitest';
import type { Report } from '../types/report.type.js';
import { render } from './render.js';

const emptyReport = (): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date(0),
    durationMs: 0,
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
});
