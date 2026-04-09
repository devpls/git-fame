import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { discover } from './discover.js';

const defaultOpts = {
  includeGenerated: false,
  includeMinified: true,
  includeGlobs: [],
  excludeGlobs: [],
} as const;

describe('discover', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns the HEAD sha and tracked file list for a repo with text files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'b.txt': 'world\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, defaultOpts);

    expect(result.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.headRef).toBe('HEAD');
    expect(result.files.sort()).toEqual(['a.txt', 'b.txt']);
    expect(result.warnings).toEqual([]);
  });

  it('filters out files with NUL bytes (binary)', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'text.txt': 'hello\n' },
      },
    ]);
    createdRepos.push(dir);

    // Add a binary file and commit it
    writeFileSync(join(dir, 'image.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    const { spawnSync } = await import('node:child_process');
    spawnSync('git', ['add', 'image.bin'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'add binary'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
        GIT_AUTHOR_NAME: 'Alice',
        GIT_AUTHOR_EMAIL: 'a@x',
        GIT_COMMITTER_NAME: 'Alice',
        GIT_COMMITTER_EMAIL: 'a@x',
      },
    });

    const result = await discover(dir, defaultOpts);

    expect(result.files).toEqual(['text.txt']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('FILE_SKIPPED_BINARY');
  });

  it('throws NotAGitRepoError for a non-git directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nfd-nongit-'));
    createdRepos.push(dir);
    await expect(discover(dir, defaultOpts)).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('returns an empty files list for an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const result = await discover(dir, defaultOpts);
    expect(result.files).toEqual([]);
  });

  it('filters out package-lock.json from the result', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, defaultOpts);

    expect(result.files).toEqual(['a.txt']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('FILE_SKIPPED_GENERATED');
  });

  it('keeps package-lock.json when includeGenerated is true', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, { ...defaultOpts, includeGenerated: true });

    expect(result.files.sort()).toEqual(['a.txt', 'package-lock.json']);
    expect(result.warnings).toEqual([]);
  });

  it('honours .gitattributes linguist-generated=false to whitelist a built-in pattern', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: {
          'a.txt': 'hello\n',
          'package-lock.json': '{"lockfileVersion":3}\n',
          '.gitattributes': 'package-lock.json linguist-generated=false\n',
        },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, defaultOpts);

    expect(result.files.sort()).toEqual(['.gitattributes', 'a.txt', 'package-lock.json']);
    expect(result.warnings).toEqual([]);
  });

  it('filters out minified files when includeMinified is false', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'normal.txt': 'hello\n', 'bundle.js': 'x'.repeat(1000) },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, { ...defaultOpts, includeMinified: false });

    expect(result.files).toEqual(['normal.txt']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('FILE_SKIPPED_MINIFIED');
  });

  it('respects user includeGlobs to narrow the file set', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'index.ts': 'const x = 1;\n', 'README.md': '# readme\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir, { ...defaultOpts, includeGlobs: ['*.ts'] });

    expect(result.files).toEqual(['index.ts']);
    expect(result.warnings).toEqual([]);
  });
});
