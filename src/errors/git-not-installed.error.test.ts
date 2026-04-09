import { describe, expect, it } from 'vitest';
import { GitNotInstalledError } from './git-not-installed.error.js';
import { NodeFameError } from './node-fame.error.js';

describe('GitNotInstalledError', () => {
  it('extends NodeFameError with code git_not_installed', () => {
    const err = new GitNotInstalledError();
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('git_not_installed');
    expect(err.name).toBe('GitNotInstalledError');
  });

  it('accepts a custom message', () => {
    const err = new GitNotInstalledError('git 2.10 is too old');
    expect(err.message).toBe('git 2.10 is too old');
  });
});
