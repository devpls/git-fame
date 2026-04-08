import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildBlameFixture } from '../../../tests/helpers/build-blame-fixture.js';
import { parseBlamePorcelain, type BlameLine } from './parse-blame-porcelain.js';

const streamOf = (text: string): NodeJS.ReadableStream => Readable.from([text]);

const collect = async (gen: AsyncGenerator<BlameLine>): Promise<BlameLine[]> => {
  const out: BlameLine[] = [];
  for await (const item of gen) {
    out.push(item);
  }
  return out;
};

describe('parseBlamePorcelain', () => {
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
});
