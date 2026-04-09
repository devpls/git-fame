import { rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBlameFixture } from '../../../../tests/helpers/build-blame-fixture.js';
import { buildRepo } from '../../../../tests/helpers/build-repo.js';
import { spawnGit } from '../../git/spawn-git.js';
import { parseBlamePorcelain } from './parse-blame-porcelain.js';
import type { BlameLine } from './types/blame-line.type.js';

const streamOf = (text: string): NodeJS.ReadableStream => Readable.from([text]);

const collect = async (gen: AsyncGenerator<BlameLine>): Promise<BlameLine[]> => {
  const out: BlameLine[] = [];
  for await (const item of gen) {
    out.push(item);
  }
  return out;
};

describe('parseBlamePorcelain', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('parses a single content line with full header block', async () => {
    const fixture = buildBlameFixture([
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

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toStrictEqual({
      sha: '3f1c2a7b9d4e5f6a1c8b9d0e2f3a4b5c6d7e8f90',
      authorName: 'Alice',
      authorMail: 'alice@example.com',
      authorTime: 1704067200,
      line: 'hello world',
      isBoundary: false,
    });
  });

  it('parses multiple lines from the same commit in order', async () => {
    const fixture = buildBlameFixture([
      {
        sha: '1111111111111111111111111111111111111111',
        origLine: 1,
        finalLine: 1,
        groupCount: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Commit',
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
        summary: 'Commit',
        filename: 'a.txt',
        content: 'line two',
      },
      {
        sha: '1111111111111111111111111111111111111111',
        origLine: 3,
        finalLine: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Commit',
        filename: 'a.txt',
        content: 'line three',
      },
    ]);

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines.map((l) => l.line)).toEqual(['line one', 'line two', 'line three']);
    expect(lines.every((l) => l.authorName === 'Alice')).toBe(true);
  });

  it('sets isBoundary to true when the boundary marker is present', async () => {
    const fixture = buildBlameFixture([
      {
        sha: 'ccc0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Oldest commit',
        boundary: true,
        filename: 'a.txt',
        content: 'the first line ever',
      },
    ]);

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines).toHaveLength(1);
    expect(lines[0]?.isBoundary).toBe(true);
  });

  it('tracks distinct authors across consecutive entries', async () => {
    const fixture = buildBlameFixture([
      {
        sha: 'aaa0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        filename: 'a.txt',
        content: 'written by alice',
      },
      {
        sha: 'bbb0000000000000000000000000000000000000',
        origLine: 2,
        finalLine: 2,
        groupCount: 1,
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        authorTime: 1704153600,
        summary: 'second',
        filename: 'a.txt',
        content: 'written by bob',
      },
    ]);

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines).toHaveLength(2);
    expect(lines[0]?.authorName).toBe('Alice');
    expect(lines[1]?.authorName).toBe('Bob');
    expect(lines[0]?.line).toBe('written by alice');
    expect(lines[1]?.line).toBe('written by bob');
  });

  it('handles non-ASCII author names, emails, and content', async () => {
    const fixture = buildBlameFixture([
      {
        sha: 'a000000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Михаил',
        authorMail: 'михаил@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'файл.txt',
        content: 'строка с юникодом',
      },
    ]);

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines[0]).toStrictEqual({
      sha: 'a000000000000000000000000000000000000000',
      authorName: 'Михаил',
      authorMail: 'михаил@example.com',
      authorTime: 1704067200,
      line: 'строка с юникодом',
      isBoundary: false,
    });
  });

  it('yields nothing for an empty stream', async () => {
    const lines = await collect(parseBlamePorcelain(streamOf('')));
    expect(lines).toEqual([]);
  });

  it('parses CRLF line endings as if they were LF', async () => {
    const fixture = buildBlameFixture([
      {
        sha: 'a000000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'hello',
      },
    ]);
    const crlfFixture = fixture.replace(/\n/g, '\r\n');

    const lines = await collect(parseBlamePorcelain(streamOf(crlfFixture)));

    expect(lines).toHaveLength(1);
    expect(lines[0]?.line).toBe('hello');
  });

  it('throws when a content line arrives without a complete header block', async () => {
    const malformed = '\tjust content, no header\n';
    await expect(collect(parseBlamePorcelain(streamOf(malformed)))).rejects.toThrow(
      /content line before complete header/,
    );
  });

  it('throws on unexpected end of stream mid-block', async () => {
    const truncated =
      'a000000000000000000000000000000000000000 1 1 1\n' +
      'author Alice\n' +
      'author-mail <alice@example.com>\n';
    await expect(collect(parseBlamePorcelain(streamOf(truncated)))).rejects.toThrow(
      /unexpected end of stream/,
    );
  });

  it('throws when a header line arrives before the previous entry finished', async () => {
    const bad =
      'a000000000000000000000000000000000000000 1 1 1\n' +
      'author Alice\n' +
      'author-mail <alice@example.com>\n' +
      'author-time 1704067200\n' +
      'b000000000000000000000000000000000000000 2 2\n';
    await expect(collect(parseBlamePorcelain(streamOf(bad)))).rejects.toThrow(
      /header line arrived before previous entry finished/,
    );
  });

  it('reuses cached author info for subsequent lines from the same SHA', async () => {
    const sha = '1111111111111111111111111111111111111111';
    const fixture = buildBlameFixture([
      {
        sha,
        origLine: 1,
        finalLine: 1,
        groupCount: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Multi-line commit',
        filename: 'a.txt',
        content: 'first',
      },
      {
        sha,
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Multi-line commit',
        filename: 'a.txt',
        content: 'second',
      },
      {
        sha,
        origLine: 3,
        finalLine: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'Multi-line commit',
        filename: 'a.txt',
        content: 'third',
      },
    ]);

    const lines = await collect(parseBlamePorcelain(streamOf(fixture)));

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.line)).toEqual(['first', 'second', 'third']);
    expect(lines.every((l) => l.authorName === 'Alice')).toBe(true);
    expect(lines.every((l) => l.authorMail === 'alice@example.com')).toBe(true);
    expect(lines.every((l) => l.authorTime === 1704067200)).toBe(true);
    expect(lines.every((l) => l.sha === sha)).toBe(true);
  });

  it('parses real git blame --porcelain output for a two-author file', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'mixed.txt': 'alice one\nalice two\nalice three\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'mixed.txt': 'alice one\nBOB EDIT\nalice three\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = spawnGit(['blame', '--porcelain', 'HEAD', '--', 'mixed.txt'], dir);
    const lines: BlameLine[] = [];
    const consume = async (): Promise<void> => {
      for await (const line of parseBlamePorcelain(result.stdout)) {
        lines.push(line);
      }
    };
    await Promise.all([consume(), result.done]);

    expect(lines).toHaveLength(3);
    expect(lines[0]?.authorName).toBe('Alice');
    expect(lines[0]?.line).toBe('alice one');
    expect(lines[1]?.authorName).toBe('Bob');
    expect(lines[1]?.line).toBe('BOB EDIT');
    expect(lines[2]?.authorName).toBe('Alice');
    expect(lines[2]?.line).toBe('alice three');
  });
});
