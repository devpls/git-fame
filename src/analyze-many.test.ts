import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeMany } from './analyze-many.js';
import { buildRepo } from '../tests/helpers/build-repo.js';
import { buildRepoWithSubmodule } from '../tests/helpers/build-repo-with-submodule.js';

describe('analyzeMany', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns array of reports for split submodules', async () => {
    const { parentDir } = buildRepoWithSubmodule();
    createdRepos.push(parentDir);

    const reports = await analyzeMany({
      path: parentDir,
      submodules: true,
      splitSubmodules: true,
    });

    expect(reports.length).toBeGreaterThanOrEqual(2);
    const subReport = reports.find((r) => r.repo.path.includes('lib'));
    expect(subReport).toBeDefined();
    expect(subReport?.authors.some((a) => a.email === 'lib@example.com')).toBe(true);
  });

  it('analyzes sibling repos in recursive mode', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'node-fame-recursive-'));
    createdRepos.push(workspace);

    // Create two sibling repos
    for (const [name, author] of [
      ['repo1', 'Alice <a@x>'],
      ['repo2', 'Bob <b@x>'],
    ] as const) {
      const dir = join(workspace, name);
      mkdirSync(dir);
      spawnSync('git', ['init', '--initial-branch=main'], { cwd: dir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      spawnSync('git', ['config', 'user.email', 'test@x'], { cwd: dir });
      spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
      writeFileSync(join(dir, 'file.txt'), 'content\n', 'utf8');
      spawnSync('git', ['add', '.'], { cwd: dir });
      spawnSync('git', ['commit', '-m', 'init', '--author', author], {
        cwd: dir,
        env: {
          ...process.env,
          GIT_COMMITTER_DATE: '2024-01-01T00:00:00Z',
          GIT_AUTHOR_DATE: '2024-01-01T00:00:00Z',
        },
      });
    }

    const reports = await analyzeMany({ path: workspace, recursive: true });
    expect(reports).toHaveLength(2);
  });

  it('returns single-element array when no special flags', async () => {
    const dir = buildRepo([
      { author: 'A <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'x\n' } },
    ]);
    createdRepos.push(dir);

    const reports = await analyzeMany({ path: dir });
    expect(reports).toHaveLength(1);
  });
});
