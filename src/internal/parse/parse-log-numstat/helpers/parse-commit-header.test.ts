import { describe, expect, it } from 'vitest';
import { parseCommitHeader } from './parse-commit-header.js';

describe('parseCommitHeader', () => {
  it('parses a 4-field NUL-separated header', () => {
    const result = parseCommitHeader(
      'abc0000000000000000000000000000000000000\x00Alice\x00alice@example.com\x001704067200',
    );
    expect(result).toStrictEqual({
      sha: 'abc0000000000000000000000000000000000000',
      authorName: 'Alice',
      authorMail: 'alice@example.com',
      authorTime: 1704067200,
      files: [],
    });
  });

  it('initialises files as an empty array', () => {
    const result = parseCommitHeader('a\x00b\x00c\x001');
    expect(result.files).toEqual([]);
  });

  it('throws on fewer than 4 NUL-separated fields', () => {
    expect(() => parseCommitHeader('only\x00three\x00fields')).toThrow(/4 NUL-separated header/);
  });

  it('throws on more than 4 NUL-separated fields', () => {
    expect(() => parseCommitHeader('a\x00b\x00c\x00d\x00e')).toThrow(/4 NUL-separated header/);
  });

  it('parses non-ASCII name and email', () => {
    const result = parseCommitHeader('a\x00Михаил\x00михаил@example.com\x001704067200');
    expect(result.authorName).toBe('Михаил');
    expect(result.authorMail).toBe('михаил@example.com');
  });
});
