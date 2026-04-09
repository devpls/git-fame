import { describe, expect, it } from 'vitest';
import { parseGitattributesLine } from './parse-gitattributes-line.js';

describe('parseGitattributesLine', () => {
  it('parses a pattern with one boolean attribute', () => {
    expect(parseGitattributesLine('*.lock linguist-generated')).toStrictEqual({
      pattern: '*.lock',
      attrs: { 'linguist-generated': true },
    });
  });

  it('parses a pattern with multiple attributes', () => {
    expect(parseGitattributesLine('vendor/** linguist-vendored linguist-generated')).toStrictEqual({
      pattern: 'vendor/**',
      attrs: { 'linguist-vendored': true, 'linguist-generated': true },
    });
  });

  it('parses an attribute with explicit true value', () => {
    expect(parseGitattributesLine('dist/** linguist-generated=true')).toStrictEqual({
      pattern: 'dist/**',
      attrs: { 'linguist-generated': true },
    });
  });

  it('parses an attribute with explicit false value', () => {
    expect(parseGitattributesLine('important.json linguist-generated=false')).toStrictEqual({
      pattern: 'important.json',
      attrs: { 'linguist-generated': false },
    });
  });

  it('returns null for a blank line', () => {
    expect(parseGitattributesLine('')).toBeNull();
    expect(parseGitattributesLine('   ')).toBeNull();
  });

  it('returns null for a comment line', () => {
    expect(parseGitattributesLine('# this is a comment')).toBeNull();
  });

  it('returns null for a line that has no attributes', () => {
    expect(parseGitattributesLine('only-pattern')).toBeNull();
  });

  it('ignores attributes other than linguist-generated and linguist-vendored', () => {
    expect(parseGitattributesLine('*.txt text eol=lf')).toBeNull();
  });

  it('handles tab as field separator', () => {
    expect(parseGitattributesLine('*.lock\tlinguist-generated')).toStrictEqual({
      pattern: '*.lock',
      attrs: { 'linguist-generated': true },
    });
  });
});
