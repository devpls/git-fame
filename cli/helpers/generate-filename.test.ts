import { describe, expect, it } from 'vitest';
import { generateFilename } from './generate-filename.js';

describe('generateFilename', () => {
  const timestamp = '20260427T120000';

  it('uses basename of repoPath when scanRoot is undefined', () => {
    expect(generateFilename('/home/user/my-repo', undefined, timestamp, 'json')).toBe(
      'git-fame-report_my-repo_20260427T120000.json',
    );
  });

  it('uses basename of scanRoot when relative path is empty', () => {
    expect(generateFilename('/home/repos', '/home/repos', timestamp, 'csv')).toBe(
      'git-fame-report_repos_20260427T120000.csv',
    );
  });

  it('uses basename of scanRoot when relative path is "."', () => {
    expect(generateFilename('/home/repos/.', '/home/repos', timestamp, 'table')).toBe(
      'git-fame-report_repos_20260427T120000.txt',
    );
  });

  it('replaces slashes with -- in relative path', () => {
    expect(generateFilename('/home/repos/org/project', '/home/repos', timestamp, 'markdown')).toBe(
      'git-fame-report_org--project_20260427T120000.md',
    );
  });

  it('sanitizes spaces and special chars to kebab-case', () => {
    expect(generateFilename('/home/repos/My Project (v2)', undefined, timestamp, 'json')).toBe(
      'git-fame-report_my-project--v2_20260427T120000.json',
    );
  });

  it('handles backslash separators (Windows paths)', () => {
    expect(generateFilename('/home/repos/org\\project', '/home/repos', timestamp, 'json')).toBe(
      'git-fame-report_org--project_20260427T120000.json',
    );
  });

  it('lowercases the name', () => {
    expect(generateFilename('/home/user/MyRepo', undefined, timestamp, 'json')).toBe(
      'git-fame-report_myrepo_20260427T120000.json',
    );
  });

  it('resolves "." to current directory basename', () => {
    const result = generateFilename('.', undefined, timestamp, 'json');
    expect(result).not.toContain('_._');
    expect(result).toMatch(/^git-fame-report_[a-z0-9._-]+_20260427T120000\.json$/);
  });

  it('defaults unknown format to .txt extension', () => {
    expect(generateFilename('/home/user/my-repo', undefined, timestamp, 'custom')).toBe(
      'git-fame-report_my-repo_20260427T120000.txt',
    );
  });
});
