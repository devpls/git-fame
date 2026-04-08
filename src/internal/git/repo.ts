import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function isGitRepo(path: string): boolean {
  const gitPath = join(path, '.git');
  if (!existsSync(gitPath)) {
    return false;
  }
  const stat = statSync(gitPath);
  // .git is a directory in normal repos and a file (gitlink) in submodules.
  return stat.isDirectory() || stat.isFile();
}
