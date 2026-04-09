import { describe, expect, it } from 'vitest';
import { NodeFameError } from './node-fame.error.js';
import { NotAGitRepoError } from './not-a-git-repo.error.js';

describe('NotAGitRepoError', () => {
  it('extends NodeFameError with code not_a_git_repo', () => {
    const err = new NotAGitRepoError('/some/path');
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('not_a_git_repo');
    expect(err.path).toBe('/some/path');
    expect(err.message).toContain('/some/path');
    expect(err.name).toBe('NotAGitRepoError');
  });
});
