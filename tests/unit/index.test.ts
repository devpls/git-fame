import { describe, expect, it } from 'vitest';
import {
  version,
  NodeFameError,
  NotAGitRepoError,
  GitNotInstalledError,
  InvalidRevError,
  ConflictingOptionsError,
  GitCommandError,
  AbortError,
} from '../../src/index.js';

describe('node-fame package entry', () => {
  it('exports a version string', () => {
    expect(typeof version).toBe('string');
  });

  it('version follows semver format (major.minor.patch)', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('re-exports all error classes', () => {
    expect(NodeFameError).toBeDefined();
    expect(NotAGitRepoError).toBeDefined();
    expect(GitNotInstalledError).toBeDefined();
    expect(InvalidRevError).toBeDefined();
    expect(ConflictingOptionsError).toBeDefined();
    expect(GitCommandError).toBeDefined();
    expect(AbortError).toBeDefined();
  });
});
