import { GitCommandError } from '../../errors/git-command.error.js';
import { InvalidRevError } from '../../errors/invalid-rev.error.js';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { collectStream } from './collect-stream.js';
import { isGitRepo } from './is-git-repo.js';
import { spawnGit } from './spawn-git.js';

export const resolveRev = async (cwd: string, rev: string): Promise<string> => {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  try {
    const result = spawnGit(['rev-parse', '--verify', `${rev}^{commit}`], cwd);
    const [text] = await Promise.all([collectStream(result.stdout), result.done]);
    return text.trim();
  } catch (err) {
    if (err instanceof GitCommandError) {
      throw new InvalidRevError(rev, cwd);
    }
    throw err;
  }
};
