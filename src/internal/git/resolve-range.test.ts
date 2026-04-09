import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { InvalidRevError } from '../../errors/invalid-rev.error.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { resolveRange } from './resolve-range.js';

describe('resolveRange', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('resolves both endpoints to SHAs', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\n' },
      },
      {
        author: 'Alice <a@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'two\n' },
      },
    ]);
    created.push(dir);

    spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });

    const range = await resolveRange(dir, { from: 'v1', to: 'HEAD' });
    expect(range.fromSha).toMatch(/^[0-9a-f]{40}$/);
    expect(range.toSha).toMatch(/^[0-9a-f]{40}$/);
    expect(range.fromSha).not.toBe(range.toSha);
  });

  it('throws InvalidRevError if either endpoint is invalid', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'x\n' },
      },
    ]);
    created.push(dir);
    await expect(resolveRange(dir, { from: 'HEAD', to: 'v99' })).rejects.toBeInstanceOf(
      InvalidRevError,
    );
  });
});
