import { describe, expect, it } from 'vitest';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { isGenerated } from './is-generated.js';

const noAttrs: GitattributesMap = new Map();

describe('isGenerated', () => {
  it('returns true for a built-in pattern (lock file) with no gitattributes', () => {
    expect(isGenerated('package-lock.json', noAttrs)).toBe(true);
  });

  it('returns false for a normal source file with no gitattributes', () => {
    expect(isGenerated('src/index.ts', noAttrs)).toBe(false);
  });

  it('returns true for a path matched by a linguist-generated gitattributes entry', () => {
    const attrs: GitattributesMap = new Map([['*.proto', { 'linguist-generated': true }]]);
    expect(isGenerated('schemas/user.proto', attrs)).toBe(true);
  });

  it('returns true for a path matched by a linguist-vendored gitattributes entry', () => {
    const attrs: GitattributesMap = new Map([['third-party/**', { 'linguist-vendored': true }]]);
    expect(isGenerated('third-party/foo/bar.js', attrs)).toBe(true);
  });

  it('lets gitattributes linguist-generated=false override a built-in match', () => {
    const attrs: GitattributesMap = new Map([
      ['package-lock.json', { 'linguist-generated': false }],
    ]);
    expect(isGenerated('package-lock.json', attrs)).toBe(false);
  });

  it('returns false when no built-in match and no relevant gitattributes', () => {
    const attrs: GitattributesMap = new Map([['*.md', { 'linguist-vendored': false }]]);
    expect(isGenerated('README.md', attrs)).toBe(false);
  });
});
