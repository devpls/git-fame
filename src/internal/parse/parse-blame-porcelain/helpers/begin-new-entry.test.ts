import { describe, expect, it } from 'vitest';
import { beginNewEntry } from './begin-new-entry.js';

describe('beginNewEntry', () => {
  it('returns a fresh partial entry when state is null', () => {
    const result = beginNewEntry(null, 'abc0000000000000000000000000000000000000');
    expect(result).toStrictEqual({
      sha: 'abc0000000000000000000000000000000000000',
      isBoundary: false,
    });
  });

  it('throws when the previous entry has not been finished', () => {
    expect(() =>
      beginNewEntry(
        {
          sha: 'previous0000000000000000000000000000000',
          authorName: 'Alice',
          authorMail: 'alice@example.com',
          authorTime: 1704067200,
          isBoundary: false,
        },
        'next00000000000000000000000000000000000',
      ),
    ).toThrow(/header line arrived before previous entry finished/);
  });

  it('initialises isBoundary to false', () => {
    const result = beginNewEntry(null, 'x'.repeat(40));
    expect(result.isBoundary).toBe(false);
  });
});
