import { describe, expect, it } from 'vitest';
import { renderBreakdownTable } from './render-breakdown-table.js';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

describe('renderBreakdownTable', () => {
  it('renders breakdown entries as a table', () => {
    const entries: BreakdownEntry[] = [
      { group: '.ts', linesAlive: 5000, files: 120 },
      { group: '.css', linesAlive: 200, files: 15 },
    ];
    const output = renderBreakdownTable(entries);
    expect(output).toContain('.ts');
    expect(output).toContain('5000');
    expect(output).toContain('.css');
    expect(output).toContain('group');
  });
});
