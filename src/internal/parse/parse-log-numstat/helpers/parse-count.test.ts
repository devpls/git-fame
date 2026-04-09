import { describe, expect, it } from 'vitest';
import { parseCount } from './parse-count.js';

describe('parseCount', () => {
  it('returns 0 for a literal dash', () => {
    expect(parseCount('-')).toBe(0);
  });

  it('returns the numeric value for a numeric string', () => {
    expect(parseCount('42')).toBe(42);
    expect(parseCount('0')).toBe(0);
  });

  it('handles large numbers', () => {
    expect(parseCount('1000000')).toBe(1000000);
  });
});
