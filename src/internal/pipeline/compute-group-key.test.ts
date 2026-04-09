import { describe, expect, it } from 'vitest';
import { computeGroupKey } from './compute-group-key.js';

describe('computeGroupKey', () => {
  it('extracts file extension', () => {
    expect(computeGroupKey('src/app.ts', { type: 'extension', depth: 0 })).toBe('.ts');
  });

  it('returns (no ext) for extensionless files', () => {
    expect(computeGroupKey('Makefile', { type: 'extension', depth: 0 })).toBe('(no ext)');
  });

  it('extracts top-level directory at depth 1', () => {
    expect(computeGroupKey('src/internal/git/spawn.ts', { type: 'directory', depth: 1 })).toBe(
      'src',
    );
  });

  it('extracts two levels at depth 2', () => {
    expect(computeGroupKey('src/internal/git/spawn.ts', { type: 'directory', depth: 2 })).toBe(
      'src/internal',
    );
  });

  it('returns (root) for root-level files', () => {
    expect(computeGroupKey('README.md', { type: 'directory', depth: 1 })).toBe('(root)');
  });

  it('returns full dir when depth exceeds path segments', () => {
    expect(computeGroupKey('src/app.ts', { type: 'directory', depth: 5 })).toBe('src');
  });
});
