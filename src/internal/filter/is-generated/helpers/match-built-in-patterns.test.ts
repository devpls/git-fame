import { describe, expect, it } from 'vitest';
import { matchBuiltInPatterns } from './match-built-in-patterns.js';

describe('matchBuiltInPatterns', () => {
  it('matches package-lock.json at repo root', () => {
    expect(matchBuiltInPatterns('package-lock.json')).toBe(true);
  });

  it('matches package-lock.json deep in a subdirectory', () => {
    expect(matchBuiltInPatterns('apps/web/package-lock.json')).toBe(true);
  });

  it('matches drizzle migration meta snapshots', () => {
    expect(matchBuiltInPatterns('drizzle/migrations/meta/0001_snapshot.json')).toBe(true);
  });

  it('matches files inside dist/ at repo root', () => {
    expect(matchBuiltInPatterns('dist/index.js')).toBe(true);
  });

  it('matches minified JavaScript', () => {
    expect(matchBuiltInPatterns('apps/web/public/vendor.min.js')).toBe(true);
  });

  it('does not match a normal source file', () => {
    expect(matchBuiltInPatterns('src/index.ts')).toBe(false);
  });

  it('does not match README.md', () => {
    expect(matchBuiltInPatterns('README.md')).toBe(false);
  });

  it('does not match a .test.ts file', () => {
    expect(matchBuiltInPatterns('src/foo/bar.test.ts')).toBe(false);
  });

  it('matches a .pyc file in any directory', () => {
    expect(matchBuiltInPatterns('app/utils/__pycache__/helpers.pyc')).toBe(true);
  });
});
