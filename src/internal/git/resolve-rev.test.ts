import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InvalidRevError } from '../../errors/invalid-rev.error.js';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { resolveRev } from './resolve-rev.js';

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
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-nongit-'));
    created.push(dir);
    await expect(resolveRev(dir, 'HEAD')).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('throws InvalidRevError for a non-existent ref', async () => {
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
