import { describe, expect, it } from 'vitest';
import { formatTimestamp } from './format-timestamp.js';

describe('formatTimestamp', () => {
  it('formats a UTC date as YYYYMMDDTHHMMSS', () => {
    const date = new Date('2026-04-27T14:05:09Z');
    expect(formatTimestamp(date)).toBe('20260427T140509');
  });

  it('pads single-digit months and days', () => {
    const date = new Date('2026-01-03T01:02:03Z');
    expect(formatTimestamp(date)).toBe('20260103T010203');
  });

  it('handles midnight', () => {
    const date = new Date('2026-12-31T00:00:00Z');
    expect(formatTimestamp(date)).toBe('20261231T000000');
  });
});
