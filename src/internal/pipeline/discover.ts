import { join } from 'node:path';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { isGenerated, loadGitattributes } from '../filter/is-generated/index.js';
import { isMinified } from '../filter/is-minified/index.js';
import { matchesUserGlobs } from '../filter/matches-user-globs/index.js';
import type { Warning } from '../../types/warning.type.js';
import { isBinary } from '../filter/is-binary/index.js';
import { isGitRepo } from '../git/is-git-repo.js';
import { listTrackedFiles } from '../git/list-tracked-files.js';
import { resolveRange } from '../git/resolve-range.js';
import { resolveRev } from '../git/resolve-rev.js';

export interface DiscoverOptions {
  includeGenerated: boolean;
  includeMinified: boolean;
  includeGlobs: readonly string[];
  excludeGlobs: readonly string[];
  rev?: string;
  range?: { from: string; to: string };
}

export interface DiscoverResult {
  headSha: string;
  headRef: string;
  files: string[];
  warnings: Warning[];
  range?: {
    fromSha: string;
    toSha: string;
    fromRef: string;
    toRef: string;
  };
}

export const discover = async (cwd: string, options: DiscoverOptions): Promise<DiscoverResult> => {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  let headSha: string;
  let headRef: string;
  let resolvedRange: DiscoverResult['range'];

  if (options.range !== undefined) {
    const { fromSha, toSha } = await resolveRange(cwd, options.range).catch(() => ({
      fromSha: '',
      toSha: '',
    }));
    headSha = toSha;
    headRef = options.range.to;
    resolvedRange = {
      fromSha,
      toSha,
      fromRef: options.range.from,
      toRef: options.range.to,
    };
  } else {
    const ref = options.rev ?? 'HEAD';
    headSha = await resolveRev(cwd, ref).catch(() => '');
    headRef = ref;
    resolvedRange = undefined;
  }

  const allFiles = await listTrackedFiles(cwd);
  const warnings: Warning[] = [];
  const textFiles: string[] = [];

  const attrs = options.includeGenerated ? null : loadGitattributes(cwd);

  for (const relPath of allFiles) {
    const absPath = join(cwd, relPath);
    try {
      if (!matchesUserGlobs(relPath, options.includeGlobs, options.excludeGlobs)) {
        continue;
      }
      if (attrs !== null && isGenerated(relPath, attrs)) {
        warnings.push({
          code: 'FILE_SKIPPED_GENERATED',
          file: relPath,
          message: `${relPath} is generated; excluded from analysis`,
        });
        continue;
      }
      if (isBinary(absPath)) {
        warnings.push({
          code: 'FILE_SKIPPED_BINARY',
          file: relPath,
          message: `${relPath} is binary; excluded from analysis`,
        });
        continue;
      }
      if (!options.includeMinified && isMinified(absPath)) {
        warnings.push({
          code: 'FILE_SKIPPED_MINIFIED',
          file: relPath,
          message: `${relPath} is minified; excluded from analysis`,
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
    headRef,
    files: textFiles,
    warnings,
    ...(resolvedRange !== undefined && { range: resolvedRange }),
  };
};
