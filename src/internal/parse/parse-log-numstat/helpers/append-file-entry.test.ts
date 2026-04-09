import { describe, expect, it } from 'vitest';
import type { LogCommit } from '../types/log-commit.type.js';
import { appendFileEntry } from './append-file-entry.js';

const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

const makeCommit = (): LogCommit => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  files: [],
});

const matchOrFail = (line: string): RegExpExecArray => {
  const match = NUMSTAT_REGEX.exec(line);
  if (match === null) {
    throw new Error(`test fixture: ${line} did not match NUMSTAT_REGEX`);
  }
  return match;
};

describe('appendFileEntry', () => {
  it('adds a numeric file entry to the current commit', () => {
    const commit = makeCommit();
    appendFileEntry(commit, matchOrFail('10\t2\ta.txt'));
    expect(commit.files).toEqual([{ path: 'a.txt', added: 10, deleted: 2 }]);
  });

  it('treats dash counts as zero for binary files', () => {
    const commit = makeCommit();
    appendFileEntry(commit, matchOrFail('-\t-\tlogo.png'));
    expect(commit.files).toEqual([{ path: 'logo.png', added: 0, deleted: 0 }]);
  });

  it('appends to an existing files list in order', () => {
    const commit = makeCommit();
    appendFileEntry(commit, matchOrFail('1\t0\tfirst.txt'));
    appendFileEntry(commit, matchOrFail('2\t1\tsecond.txt'));
    expect(commit.files.map((f) => f.path)).toEqual(['first.txt', 'second.txt']);
  });

  it('throws when current is null', () => {
    expect(() => {
      appendFileEntry(null, matchOrFail('1\t0\ta.txt'));
    }).toThrow(/file entry before any commit header/);
  });
});
