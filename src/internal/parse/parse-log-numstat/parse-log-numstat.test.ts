import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildLogFixture } from '../../../../tests/helpers/build-log-fixture.js';
import { parseLogNumstat } from './parse-log-numstat.js';
import type { LogCommit } from './types/log-commit.type.js';

const streamOf = (text: string): NodeJS.ReadableStream => Readable.from([text]);

const collect = async (gen: AsyncGenerator<LogCommit>): Promise<LogCommit[]> => {
  const out: LogCommit[] = [];
  for await (const item of gen) {
    out.push(item);
  }
  return out;
};

describe('parseLogNumstat', () => {
  it('parses a single commit with a single file', async () => {
    const fixture = buildLogFixture([
      {
        sha: 'abc0000000000000000000000000000000000000',
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ added: 10, deleted: 2, path: 'a.txt' }],
      },
    ]);

    const commits = await collect(parseLogNumstat(streamOf(fixture)));

    expect(commits).toHaveLength(1);
    expect(commits[0]).toStrictEqual({
      sha: 'abc0000000000000000000000000000000000000',
      authorName: 'Alice',
      authorMail: 'alice@example.com',
      authorTime: 1704067200,
      files: [{ path: 'a.txt', added: 10, deleted: 2 }],
    });
  });

  it('parses a single commit with multiple files in order', async () => {
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

    const commits = await collect(parseLogNumstat(streamOf(fixture)));

    expect(commits).toHaveLength(1);
    expect(commits[0]?.files.map((f) => f.path)).toEqual(['first.txt', 'second.txt', 'third.txt']);
  });
});
