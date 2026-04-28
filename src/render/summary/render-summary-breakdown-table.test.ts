import { describe, expect, it } from 'vitest';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';
import { renderSummaryBreakdownTable } from './render-summary-breakdown-table.js';

describe('renderSummaryBreakdownTable', () => {
  it('renders breakdown entries as a table', () => {
    const entries: BreakdownEntry[] = [
      { group: '.ts', linesAlive: 5000, files: 120 },
      { group: '.css', linesAlive: 200, files: 15 },
    ];
    const out = renderSummaryBreakdownTable(entries);
    expect(out).toContain('.ts');
    expect(out).toContain('5000');
    expect(out).toContain('.css');
    expect(out).toContain('Group');
    expect(out).toContain('Lines Alive');
  });

  it('returns a non-empty string for an empty entries list', () => {
    const out = renderSummaryBreakdownTable([]);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
