import { describe, expect, it } from 'vitest';
import { GitCommandError } from './git-command.error.js';
import { NodeFameError } from './node-fame.error.js';

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
