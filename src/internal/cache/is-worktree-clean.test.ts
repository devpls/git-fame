import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { isWorktreeClean } from './is-worktree-clean.js';

describe('isWorktreeClean', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns true for a clean repo', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    expect(isWorktreeClean(dir)).toBe(true);
  });

  it('returns false when a tracked file is modified', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    writeFileSync(join(dir, 'a.txt'), 'modified\n', 'utf8');
    expect(isWorktreeClean(dir)).toBe(false);
  });

  it('returns true when only untracked files exist', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    writeFileSync(join(dir, 'untracked.txt'), 'junk\n', 'utf8');
    expect(isWorktreeClean(dir)).toBe(true);
  });
});
