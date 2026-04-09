import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isGitRepo } from './is-git-repo.js';

export interface SubmoduleInfo {
  name: string;
  path: string;
  initialized: boolean;
}

const SUBMODULE_PATH_RE = /^submodule\.(.+)\.path (.+)$/;

export const discoverSubmodules = (repoRoot: string): SubmoduleInfo[] => {
  const gitmodulesPath = join(repoRoot, '.gitmodules');
  if (!existsSync(gitmodulesPath)) {
    return [];
  }

  const result = spawnSync(
    'git',
    ['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    return [];
  }

  const entries: SubmoduleInfo[] = [];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const match = SUBMODULE_PATH_RE.exec(trimmed);
    if (match === null) {
      continue;
    }
    const name = match[1] ?? '';
    const path = match[2] ?? '';
    const initialized = isGitRepo(join(repoRoot, path));
    entries.push({ name, path, initialized });
  }

  return entries;
};
