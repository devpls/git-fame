import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadGitattributes } from './load-gitattributes.js';

describe('loadGitattributes', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeRepoWithGitattributes = (content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-attrs-'));
    created.push(dir);
    writeFileSync(join(dir, '.gitattributes'), content, 'utf8');
    return dir;
  };

  it('returns an empty map when .gitattributes does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-no-attrs-'));
    created.push(dir);
    const result = loadGitattributes(dir);
    expect(result.size).toBe(0);
  });

  it('returns a map keyed by pattern when .gitattributes has linguist attributes', () => {
    const dir = makeRepoWithGitattributes(
      [
        '# comment',
        '',
        '*.lock linguist-generated',
        'vendor/** linguist-vendored',
        'src/** text eol=lf',
      ].join('\n'),
    );
    const result = loadGitattributes(dir);
    expect(result.size).toBe(2);
    expect(result.get('*.lock')).toEqual({ 'linguist-generated': true });
    expect(result.get('vendor/**')).toEqual({ 'linguist-vendored': true });
    expect(result.has('src/**')).toBe(false);
  });

  it('handles a file with only comments and blank lines', () => {
    const dir = makeRepoWithGitattributes('# nothing\n\n   \n');
    const result = loadGitattributes(dir);
    expect(result.size).toBe(0);
  });

  it('respects explicit false values', () => {
    const dir = makeRepoWithGitattributes('important.json linguist-generated=false');
    const result = loadGitattributes(dir);
    expect(result.get('important.json')).toEqual({ 'linguist-generated': false });
  });
});
