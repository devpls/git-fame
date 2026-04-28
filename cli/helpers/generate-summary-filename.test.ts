import { describe, expect, it } from 'vitest';
import { generateSummaryFilename } from './generate-summary-filename.js';

describe('generateSummaryFilename', () => {
  const timestamp = '20260427T120000';

  it('generates summary filename with json extension', () => {
    expect(generateSummaryFilename(timestamp, 'json')).toBe(
      'git-fame-report_summary_20260427T120000.json',
    );
  });

  it('generates summary filename with csv extension', () => {
    expect(generateSummaryFilename(timestamp, 'csv')).toBe(
      'git-fame-report_summary_20260427T120000.csv',
    );
  });

  it('generates summary filename with md extension for markdown', () => {
    expect(generateSummaryFilename(timestamp, 'markdown')).toBe(
      'git-fame-report_summary_20260427T120000.md',
    );
  });

  it('generates summary filename with txt extension for table', () => {
    expect(generateSummaryFilename(timestamp, 'table')).toBe(
      'git-fame-report_summary_20260427T120000.txt',
    );
  });

  it('defaults to .txt for unknown format', () => {
    expect(generateSummaryFilename(timestamp, 'custom')).toBe(
      'git-fame-report_summary_20260427T120000.txt',
    );
  });
});
