import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isGitRepo } from '../../../src/internal/git/repo.js';
import { buildRepo } from '../../helpers/build-repo.js';

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

describe('resolveRev', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('resolves HEAD to a commit SHA', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const sha = await resolveRev(dir, 'HEAD');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('resolves a branch name', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const sha = await resolveRev(dir, 'main');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('throws NotAGitRepoError for a non-repo directory', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const { NotAGitRepoError } = await import('../../../src/errors.js');
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-nongit-'));
    created.push(dir);
    await expect(resolveRev(dir, 'HEAD')).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('throws InvalidRevError for a non-existent ref', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const { InvalidRevError } = await import('../../../src/errors.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    await expect(resolveRev(dir, 'v99.0.0')).rejects.toBeInstanceOf(InvalidRevError);
  });
});
