import { join } from 'node:path';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import type { Warning } from '../../types/warning.type.js';
import { isBinary } from '../filter/is-binary/index.js';
import { isGitRepo } from '../git/is-git-repo.js';
import { listTrackedFiles } from '../git/list-tracked-files.js';
import { resolveRev } from '../git/resolve-rev.js';

export interface DiscoverResult {
  headSha: string;
  headRef: string;
  files: string[];
  warnings: Warning[];
}

export const discover = async (cwd: string): Promise<DiscoverResult> => {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  const headSha = await resolveRev(cwd, 'HEAD').catch(() => '');
  const allFiles = await listTrackedFiles(cwd);
  const warnings: Warning[] = [];
  const textFiles: string[] = [];

  for (const relPath of allFiles) {
    const absPath = join(cwd, relPath);
    try {
      if (isBinary(absPath)) {
        warnings.push({
          code: 'FILE_SKIPPED_BINARY',
          file: relPath,
          message: `${relPath} is binary; excluded from analysis`,
        });
        continue;
      }
      textFiles.push(relPath);
    } catch {
      // File may not exist on disk (dangling symlink, etc). Skip silently.
    }
  }

  return {
    headSha,
    headRef: 'HEAD',
    files: textFiles,
    warnings,
  };
};
