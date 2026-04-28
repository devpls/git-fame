import { describe, expect, it } from 'vitest';
import {
  AbortError,
  ConflictingOptionsError,
  GitCommandError,
  GitNotInstalledError,
  InvalidRevError,
  NodeFameError,
  NotAGitRepoError,
  summarize,
  version,
} from './index.js';
import type { Summary, SummaryAuthor, RepoWarning } from './index.js';

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

  it('re-exports summarize', () => {
    expect(typeof summarize).toBe('function');
  });

  it('exports Summary type (compile-time check via type annotation)', () => {
    // This test exists to verify the type export compiles.
    // Runtime assertion just confirms the import path works.
    const _check: Summary | undefined = undefined;
    expect(_check).toBeUndefined();
  });

  it('exports SummaryAuthor type (compile-time check)', () => {
    const _check: SummaryAuthor | undefined = undefined;
    expect(_check).toBeUndefined();
  });

  it('exports RepoWarning type (compile-time check)', () => {
    const _check: RepoWarning | undefined = undefined;
    expect(_check).toBeUndefined();
  });
});
