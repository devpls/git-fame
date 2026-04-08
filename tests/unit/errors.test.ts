import { describe, expect, it } from 'vitest';
import {
  NodeFameError,
  NotAGitRepoError,
  GitNotInstalledError,
  InvalidRevError,
  ConflictingOptionsError,
  GitCommandError,
  AbortError,
} from '../../src/errors.js';

describe('NodeFameError', () => {
  it('is a subclass of Error', () => {
    const err = new NodeFameError('boom', 'node_fame_error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NodeFameError);
  });

  it('carries message and code', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.message).toBe('boom');
    expect(err.code).toBe('my_code');
  });

  it('sets name to NodeFameError', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.name).toBe('NodeFameError');
  });
});

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

describe('InvalidRevError', () => {
  it('extends NodeFameError with code invalid_rev', () => {
    const err = new InvalidRevError('v99.0', '/my/repo');
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('invalid_rev');
    expect(err.rev).toBe('v99.0');
    expect(err.message).toContain('v99.0');
    expect(err.message).toContain('/my/repo');
    expect(err.name).toBe('InvalidRevError');
  });

  it('exposes cwd as a readable field', () => {
    const err = new InvalidRevError('v99.0', '/my/repo');
    expect(err.cwd).toBe('/my/repo');
  });
});

describe('ConflictingOptionsError', () => {
  it('extends NodeFameError with code conflicting_options', () => {
    const err = new ConflictingOptionsError("'rev' and 'range' are mutually exclusive");
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('conflicting_options');
    expect(err.details).toBe("'rev' and 'range' are mutually exclusive");
    expect(err.name).toBe('ConflictingOptionsError');
  });
});

describe('GitCommandError', () => {
  it('extends NodeFameError with code git_command_failed', () => {
    const err = new GitCommandError('git log --numstat', '/my/repo', 'fatal: bad revision', 128);
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('git_command_failed');
    expect(err.cmd).toBe('git log --numstat');
    expect(err.cwd).toBe('/my/repo');
    expect(err.stderr).toBe('fatal: bad revision');
    expect(err.exitCode).toBe(128);
    expect(err.message).toContain('128');
    expect(err.message).toContain('fatal: bad revision');
    expect(err.name).toBe('GitCommandError');
  });

  it('handles empty stderr gracefully', () => {
    const err = new GitCommandError('git status', '/cwd', '', 1);
    expect(err.message).toContain('1');
    expect(err.message).not.toContain('undefined');
  });
});

describe('AbortError', () => {
  it('extends NodeFameError with code aborted', () => {
    const err = new AbortError();
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('aborted');
    expect(err.name).toBe('AbortError');
  });

  it('accepts a custom message', () => {
    const err = new AbortError('user cancelled');
    expect(err.message).toBe('user cancelled');
  });
});
