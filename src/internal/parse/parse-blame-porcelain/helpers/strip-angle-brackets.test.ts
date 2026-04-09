import { describe, expect, it } from 'vitest';
import { stripAngleBrackets } from './strip-angle-brackets.js';

describe('stripAngleBrackets', () => {
  it('removes leading < and trailing > from an email', () => {
    expect(stripAngleBrackets('<alice@example.com>')).toBe('alice@example.com');
  });

  it('returns the input unchanged when there are no angle brackets', () => {
    expect(stripAngleBrackets('alice@example.com')).toBe('alice@example.com');
  });

  it('returns the input unchanged when only the leading bracket is present', () => {
    expect(stripAngleBrackets('<alice@example.com')).toBe('<alice@example.com');
  });

  it('returns the input unchanged when only the trailing bracket is present', () => {
    expect(stripAngleBrackets('alice@example.com>')).toBe('alice@example.com>');
  });

  it('returns an empty string unchanged', () => {
    expect(stripAngleBrackets('')).toBe('');
  });
});
