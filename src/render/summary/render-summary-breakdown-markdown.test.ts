import { describe, expect, it } from 'vitest';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';
import { renderSummaryBreakdownMarkdown } from './render-summary-breakdown-markdown.js';

describe('renderSummaryBreakdownMarkdown', () => {
  it('renders breakdown entries as a markdown table', () => {
    const entries: BreakdownEntry[] = [
      { group: '.ts', linesAlive: 5000, files: 120 },
      { group: '.css', linesAlive: 200, files: 15 },
    ];
    const out = renderSummaryBreakdownMarkdown(entries);
    expect(out).toContain('| Group | Lines Alive | Files |');
    expect(out).toContain('| --- | --- | --- |');
    expect(out).toContain('| .ts | 5000 | 120 |');
    expect(out).toContain('| .css | 200 | 15 |');
  });

  it('returns only header and separator for an empty entries list', () => {
    const out = renderSummaryBreakdownMarkdown([]);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('| Group | Lines Alive | Files |');
    expect(lines[1]).toBe('| --- | --- | --- |');
  });
});
