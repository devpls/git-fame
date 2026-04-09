import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLogFixture } from '../../../../tests/helpers/build-log-fixture.js';
import { buildRepo } from '../../../../tests/helpers/build-repo.js';
import { collectStream } from '../../git/collect-stream.js';
import { spawnGit } from '../../git/spawn-git.js';
import { parseLogNumstat } from './parse-log-numstat.js';

describe('parseLogNumstat', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('parses a single commit with a single file', () => {
    const fixture = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: 10, deleted: 2, path: 'a.txt' }],
      },
    ]);

    const commits = parseLogNumstat(fixture);

    expect(commits).toHaveLength(1);
    expect(commits[0]).toStrictEqual({
      sha: 'abc0000000000000000000000000000000000000',
      authorName: 'Alice',
      authorMail: 'alice@example.com',
      authorTime: 1704067200,
      files: [{ path: 'a.txt', added: 10, deleted: 2 }],
    });
  });

  it('parses a single commit with multiple files in order', () => {
    const fixture = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [
          { added: 1, deleted: 0, path: 'first.txt' },
          { added: 2, deleted: 1, path: 'second.txt' },
          { added: 3, deleted: 0, path: 'third.txt' },
        ],
      },
    ]);

    const commits = parseLogNumstat(fixture);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.files.map((f) => f.path)).toEqual(['first.txt', 'second.txt', 'third.txt']);
  });

  it('parses multiple commits separated by blank lines', () => {
    const fixture = buildLogFixture([
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

    const commits = parseLogNumstat(fixture);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.authorName).toBe('Alice');
    expect(commits[0]?.files).toEqual([{ path: 'a.txt', added: 1, deleted: 0 }]);
    expect(commits[1]?.authorName).toBe('Bob');
    expect(commits[1]?.files).toEqual([{ path: 'b.txt', added: 2, deleted: 1 }]);
  });

  it('treats binary file markers as zero added and zero deleted', () => {
    const fixture = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: '-', deleted: '-', path: 'logo.png' }],
      },
    ]);

    const commits = parseLogNumstat(fixture);

    expect(commits[0]?.files).toEqual([{ path: 'logo.png', added: 0, deleted: 0 }]);
  });

  it('parses commits with zero files', () => {
    const fixture = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [],
      },
    ]);

    const commits = parseLogNumstat(fixture);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.files).toEqual([]);
  });

  it('yields nothing for an empty stream', () => {
    const commits = parseLogNumstat('');
    expect(commits).toEqual([]);
  });

  it('handles non-ASCII author and path', () => {
    const fixture = buildLogFixture([
      {
        sha: 'a000000000000000000000000000000000000000',
        authorName: 'Михаил',
        authorMail: 'михаил@example.com',
        authorTime: 1704067200,
        files: [{ added: 1, deleted: 0, path: 'файл.txt' }],
      },
    ]);

    const commits = parseLogNumstat(fixture);

    expect(commits[0]?.authorName).toBe('Михаил');
    expect(commits[0]?.authorMail).toBe('михаил@example.com');
    expect(commits[0]?.files[0]?.path).toBe('файл.txt');
  });

  it('throws when a file line appears before any commit header', () => {
    const bad = '1\t0\ta.txt\n';
    expect(() => parseLogNumstat(bad)).toThrow(/file entry before any commit header/);
  });

  it('throws on an unrecognised line', () => {
    const bad =
      'abc0000000000000000000000000000000000000\x00Alice\x00alice@example.com\x001704067200\n' +
      'not a file line\n';
    expect(() => parseLogNumstat(bad)).toThrow(/unrecognised line/);
  });

  it('parses real git log --numstat output for a multi-commit repo', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'x\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = spawnGit(
      ['log', '--no-merges', '--reverse', '--pretty=format:%H%x00%an%x00%ae%x00%at', '--numstat'],
      dir,
    );
    const [output] = await Promise.all([collectStream(result.stdout), result.done]);
    const commits = parseLogNumstat(output);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.authorName).toBe('Alice');
    expect(commits[0]?.files).toEqual([{ path: 'a.txt', added: 2, deleted: 0 }]);
    expect(commits[1]?.authorName).toBe('Bob');
    expect(commits[1]?.files).toEqual([{ path: 'b.txt', added: 1, deleted: 0 }]);
  });
});
