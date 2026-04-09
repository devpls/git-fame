import { NodeFameError } from './node-fame.error.js';

export class NotAGitRepoError extends NodeFameError {
  readonly path: string;

  constructor(path: string) {
    super(`${path} is not a git repository`, 'not_a_git_repo');
    this.name = 'NotAGitRepoError';
    this.path = path;
  }
}
