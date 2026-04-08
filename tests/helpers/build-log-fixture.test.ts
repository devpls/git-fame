import { describe, expect, it } from 'vitest';
import { buildLogFixture } from './build-log-fixture.js';

describe('buildLogFixture', () => {
  it('produces a single commit with a single file', () => {
    const result = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: 10, deleted: 0, path: 'a.txt' }],
      },
    ]);

    expect(result).toBe(
      'abc0000000000000000000000000000000000000\x00Alice\x00alice@example.com\x001704067200\n' +
        '10\t0\ta.txt\n',
    );
  });

  it('separates multiple commits with a blank line', () => {
    const result = buildLogFixture([
      {
        sha: '1111111111111111111111111111111111111111',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: 1, deleted: 0, path: 'a.txt' }],
      },
      {
        sha: '2222222222222222222222222222222222222222',
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        authorTime: 1704153600,
        files: [{ added: 2, deleted: 1, path: 'b.txt' }],
      },
    ]);

    expect(result).toBe(
      '1111111111111111111111111111111111111111\x00Alice\x00alice@example.com\x001704067200\n' +
        '1\t0\ta.txt\n' +
        '\n' +
        '2222222222222222222222222222222222222222\x00Bob\x00bob@example.com\x001704153600\n' +
        '2\t1\tb.txt\n',
    );
  });

  it('emits a dash for binary file added/deleted counts', () => {
    const result = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: '-', deleted: '-', path: 'logo.png' }],
      },
    ]);

    expect(result).toContain('-\t-\tlogo.png\n');
  });

  it('supports commits with zero files', () => {
    const result = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [],
      },
    ]);

    expect(result).toBe(
      'abc0000000000000000000000000000000000000\x00Alice\x00alice@example.com\x001704067200\n',
    );
  });

  it('returns an empty string for an empty commit list', () => {
    expect(buildLogFixture([])).toBe('');
  });

  it('preserves multi-file order within a commit', () => {
    const result = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [
          { added: 1, deleted: 0, path: 'first.txt' },
          { added: 2, deleted: 0, path: 'second.txt' },
          { added: 3, deleted: 0, path: 'third.txt' },
        ],
      },
    ]);

    const lines = result.split('\n');
    expect(lines[1]).toBe('1\t0\tfirst.txt');
    expect(lines[2]).toBe('2\t0\tsecond.txt');
    expect(lines[3]).toBe('3\t0\tthird.txt');
  });
});
