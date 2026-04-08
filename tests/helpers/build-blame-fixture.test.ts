import { describe, expect, it } from 'vitest';
import { buildBlameFixture } from './build-blame-fixture.js';

describe('buildBlameFixture', () => {
  it('produces a single-entry fixture with the full header block', () => {
    const result = buildBlameFixture([
      {
        sha: '3f1c2a7b9d4e5f6a1c8b9d0e2f3a4b5c6d7e8f90',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Initial commit',
        filename: 'a.txt',
        content: 'hello world',
      },
    ]);

    expect(result).toBe(
      '3f1c2a7b9d4e5f6a1c8b9d0e2f3a4b5c6d7e8f90 1 1 1\n' +
        'author Alice\n' +
        'author-mail <alice@example.com>\n' +
        'author-time 1704067200\n' +
        'author-tz +0000\n' +
        'committer Alice\n' +
        'committer-mail <alice@example.com>\n' +
        'committer-time 1704067200\n' +
        'committer-tz +0000\n' +
        'summary Initial commit\n' +
        'filename a.txt\n' +
        '\thello world\n',
    );
  });

  it('omits group-count when it is not provided', () => {
    const result = buildBlameFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Initial commit',
        filename: 'a.txt',
        content: 'second line',
      },
    ]);

    expect(result.split('\n')[0]).toBe('abc0000000000000000000000000000000000000 2 2');
  });

  it('emits the boundary marker when entry.boundary is true', () => {
    const result = buildBlameFixture([
      {
        sha: 'def0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Initial commit',
        boundary: true,
        filename: 'a.txt',
        content: 'the first line ever',
      },
    ]);

    expect(result).toContain('\nboundary\nfilename');
  });

  it('concatenates multiple entries in order', () => {
    const result = buildBlameFixture([
      {
        sha: '1111111111111111111111111111111111111111',
        origLine: 1,
        finalLine: 1,
        groupCount: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'First',
        filename: 'a.txt',
        content: 'line one',
      },
      {
        sha: '1111111111111111111111111111111111111111',
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'First',
        filename: 'a.txt',
        content: 'line two',
      },
    ]);

    expect(result).toContain('\tline one\n1111111111111111111111111111111111111111 2 2\n');
    expect(result).toContain('\tline two\n');
  });

  it('uses author fields as committer defaults when committer fields are not specified', () => {
    const result = buildBlameFixture([
      {
        sha: 'a000000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 's',
        filename: 'f',
        content: 'x',
      },
    ]);

    expect(result).toContain('committer Alice\n');
    expect(result).toContain('committer-mail <alice@example.com>\n');
    expect(result).toContain('committer-time 1704067200\n');
  });

  it('uses explicit committer fields when provided', () => {
    const result = buildBlameFixture([
      {
        sha: 'a000000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        committerName: 'Bob',
        committerMail: 'bob@example.com',
        committerTime: 1704067300,
        summary: 's',
        filename: 'f',
        content: 'x',
      },
    ]);

    expect(result).toContain('committer Bob\n');
    expect(result).toContain('committer-mail <bob@example.com>\n');
    expect(result).toContain('committer-time 1704067300\n');
  });
});
