import { describe, expect, it } from 'vitest';
import { parseMailmapLine } from './parse-mailmap-line.js';

describe('parseMailmapLine', () => {
  it('returns undefined for a blank line', () => {
    expect(parseMailmapLine('')).toBeUndefined();
    expect(parseMailmapLine('   ')).toBeUndefined();
  });

  it('returns undefined for a comment line', () => {
    expect(parseMailmapLine('# this is a comment')).toBeUndefined();
  });

  it('returns undefined for a line with no email', () => {
    expect(parseMailmapLine('Alice Smith')).toBeUndefined();
  });

  it('parses form 1: proper name with commit email (same email)', () => {
    const entry = parseMailmapLine('Alice Smith <alice@x>');
    expect(entry).toEqual({
      proper: { name: 'Alice Smith', email: 'alice@x' },
      commit: { name: undefined, email: 'alice@x' },
    });
  });

  it('parses form 2: proper name + proper email + commit email', () => {
    const entry = parseMailmapLine('Alice Smith <alice@new> <alice@old>');
    expect(entry).toEqual({
      proper: { name: 'Alice Smith', email: 'alice@new' },
      commit: { name: undefined, email: 'alice@old' },
    });
  });

  it('parses form 3: proper email + commit email only (no names)', () => {
    const entry = parseMailmapLine('<alice@new> <alice@old>');
    expect(entry).toEqual({
      proper: { name: '', email: 'alice@new' },
      commit: { name: undefined, email: 'alice@old' },
    });
  });

  it('parses form 4: full mapping with both proper and commit name', () => {
    const entry = parseMailmapLine('Alice Smith <alice@new> ali <alice@old>');
    expect(entry).toEqual({
      proper: { name: 'Alice Smith', email: 'alice@new' },
      commit: { name: 'ali', email: 'alice@old' },
    });
  });

  it('trims leading and trailing whitespace from the line', () => {
    const entry = parseMailmapLine('  Alice Smith <alice@x>  ');
    expect(entry?.proper.name).toBe('Alice Smith');
    expect(entry?.proper.email).toBe('alice@x');
  });
});
