import { describe, expect, it } from 'vitest';
import { formatExtension } from './format-extension.js';

describe('formatExtension', () => {
  it('returns .json for json', () => {
    expect(formatExtension('json')).toBe('.json');
  });

  it('returns .csv for csv', () => {
    expect(formatExtension('csv')).toBe('.csv');
  });

  it('returns .md for markdown', () => {
    expect(formatExtension('markdown')).toBe('.md');
  });

  it('returns .txt for table', () => {
    expect(formatExtension('table')).toBe('.txt');
  });

  it('defaults to .txt for unknown format', () => {
    expect(formatExtension('custom')).toBe('.txt');
  });
});
