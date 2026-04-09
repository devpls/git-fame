import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepoWithSubmodule } from './build-repo-with-submodule.js';

describe('buildRepoWithSubmodule', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('creates a parent with .gitmodules and initialised submodule', () => {
    const { parentDir, submoduleDir } = buildRepoWithSubmodule();
    created.push(parentDir);

    expect(existsSync(join(parentDir, '.gitmodules'))).toBe(true);
    expect(existsSync(join(submoduleDir, '.git'))).toBe(true);
  });

  it('parent repo has tracked files with parent.txt', () => {
    const { parentDir } = buildRepoWithSubmodule();
    created.push(parentDir);

    const result = spawnSync('git', ['ls-files'], { cwd: parentDir, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.split('\n')).toContain('parent.txt');
  });
});
