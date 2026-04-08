import { describe, expect, it } from 'vitest';
import { finaliseContentLine } from './finalise-content-line.js';

describe('finaliseContentLine', () => {
  it('builds a BlameLine from a complete state and a tab-prefixed raw line', () => {
    const result = finaliseContentLine(
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        isBoundary: false,
      },
      '\thello world',
    );

    expect(result).toStrictEqual({
      sha: 'abc0000000000000000000000000000000000000',
      authorName: 'Alice',
      authorMail: 'alice@example.com',
      authorTime: 1704067200,
      line: 'hello world',
      isBoundary: false,
    });
  });

  it('preserves the isBoundary flag from state', () => {
    const result = finaliseContentLine(
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        isBoundary: true,
      },
      '\tthe first line',
    );
    expect(result.isBoundary).toBe(true);
  });

  it('throws when state is null', () => {
    expect(() => finaliseContentLine(null, '\tcontent')).toThrow(
      /content line before complete header/,
    );
  });

  it('throws when authorName is missing', () => {
    expect(() =>
      finaliseContentLine(
        {
          sha: 'abc0000000000000000000000000000000000000',
          authorMail: 'alice@example.com',
          authorTime: 1704067200,
          isBoundary: false,
        },
        '\tcontent',
      ),
    ).toThrow(/content line before complete header/);
  });

  it('throws when authorMail is missing', () => {
    expect(() =>
      finaliseContentLine(
        {
          sha: 'abc0000000000000000000000000000000000000',
          authorName: 'Alice',
          authorTime: 1704067200,
          isBoundary: false,
        },
        '\tcontent',
      ),
    ).toThrow(/content line before complete header/);
  });

  it('throws when authorTime is missing', () => {
    expect(() =>
      finaliseContentLine(
        {
          sha: 'abc0000000000000000000000000000000000000',
          authorName: 'Alice',
          authorMail: 'alice@example.com',
          isBoundary: false,
        },
        '\tcontent',
      ),
    ).toThrow(/content line before complete header/);
  });

  it('strips the leading tab from the raw line', () => {
    const result = finaliseContentLine(
      {
        sha: 'a000000000000000000000000000000000000000',
        authorName: 'A',
        authorMail: 'a@b',
        authorTime: 0,
        isBoundary: false,
      },
      '\tindented\tcontent',
    );
    expect(result.line).toBe('indented\tcontent');
  });
});
