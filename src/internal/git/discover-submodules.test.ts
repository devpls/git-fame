import { existsSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { buildRepoWithSubmodule } from '../../../tests/helpers/build-repo-with-submodule.js';
import { discoverSubmodules } from './discover-submodules.js';

describe('discoverSubmodules', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns empty array for a repo with no submodules', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n' },
      },
    ]);
    created.push(dir);

    expect(discoverSubmodules(dir)).toEqual([]);
  });

  it('discovers an initialised submodule with correct path and initialized=true', () => {
    const { parentDir } = buildRepoWithSubmodule();
    created.push(parentDir);

    const submodules = discoverSubmodules(parentDir);
    expect(submodules).toHaveLength(1);
    expect(submodules[0]).toMatchObject({
      name: 'lib',
      path: 'lib',
      initialized: true,
    });
  });
});
