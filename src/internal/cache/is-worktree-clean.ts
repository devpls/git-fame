import { spawnSync } from 'node:child_process';

export const isWorktreeClean = (cwd: string): boolean => {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
  });
  if (result.status !== 0) {
    return false;
  }
  return result.stdout.trim().length === 0;
};
