import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { isGitRepo } from './is-git-repo.js';

describe('isGitRepo', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns true for a freshly initialised git repository', () => {
    const dir = buildRepo([]);
    created.push(dir);
    expect(isGitRepo(dir)).toBe(true);
  });

  it('returns false for a non-git directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-nongit-'));
    created.push(dir);
    expect(isGitRepo(dir)).toBe(false);
  });

  it('returns false for a non-existent path', () => {
    expect(isGitRepo('/this/path/does/not/exist/ever')).toBe(false);
  });

  it('returns true when .git is a file (submodule layout)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-sub-'));
    created.push(dir);
    writeFileSync(join(dir, '.git'), 'gitdir: ../.git/modules/sub\n', 'utf8');
    expect(isGitRepo(dir)).toBe(true);
  });
});
