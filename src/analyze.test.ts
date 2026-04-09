import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { ConflictingOptionsError } from './errors/conflicting-options.error.js';
import { buildRepo } from '../tests/helpers/build-repo.js';
import { buildRepoWithSubmodule } from '../tests/helpers/build-repo-with-submodule.js';

describe('analyze', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('produces a Report with correct totals for a two-author repo', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    expect(report.meta.version).toBe('0.1.0');
    expect(report.repo.path).toBe(dir);
    expect(report.repo.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(report.authors).toHaveLength(2);

    const alice = report.authors.find((a) => a.email === 'alice@example.com');
    const bob = report.authors.find((a) => a.email === 'bob@example.com');
    expect(alice?.linesAlive).toBe(1);
    expect(bob?.linesAlive).toBe(1);
    expect(alice?.linesAdded).toBe(2);
    expect(bob?.linesAdded).toBe(1);
    expect(bob?.linesDeleted).toBe(1);
  });

  it('returns an empty authors array for an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.authors).toEqual([]);
    expect(report.repo.totals).toEqual({ lines: 0, commits: 0, files: 0 });
  });

  it('records a duration greater than or equal to zero', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('excludes generated files (lock files) by default', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Only a.txt contributes 1 line; package-lock.json is excluded
    expect(alice?.linesAlive).toBe(1);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(true);
  });

  it('includes generated files when include.generated is true', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, include: { generated: true } });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Both files contribute: a.txt (1 line) + package-lock.json (1 line) = 2 lines
    expect(alice?.linesAlive).toBe(2);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(false);
  });

  it('merges identities via .mailmap by default', async () => {
    const dir = buildRepo([
      {
        author: 'Alice Old <alice@old>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
      {
        author: 'Alice New <alice@new>',
        date: '2024-01-02T00:00:00Z',
        files: {
          'b.txt': 'line two\n',
          '.mailmap': 'Alice New <alice@new> <alice@old>\n',
        },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    expect(report.authors).toHaveLength(1);
    expect(report.authors[0]?.email).toBe('alice@new');
  });

  it('does not apply mailmap when options.applyMailmap is false', async () => {
    const dir = buildRepo([
      {
        author: 'Alice Old <alice@old>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
      {
        author: 'Alice New <alice@new>',
        date: '2024-01-02T00:00:00Z',
        files: {
          'b.txt': 'line two\n',
          '.mailmap': 'Alice New <alice@new> <alice@old>\n',
        },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, options: { applyMailmap: false } });

    expect(report.authors).toHaveLength(2);
  });

  it('respects includeGlobs to filter files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'index.ts': 'const x = 1;\n', 'README.md': '# readme\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, includeGlobs: ['*.ts'] });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Only index.ts contributes 1 line; README.md is excluded by glob
    expect(alice?.linesAlive).toBe(1);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(false);
  });

  it('excludes minified files when include.minified is false', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'normal.txt': 'hello\n', 'bundle.js': 'x'.repeat(1000) },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, include: { minified: false } });

    const alice = report.authors.find((a) => a.email === 'a@x');
    // Only normal.txt contributes 1 line; bundle.js is excluded as minified
    expect(alice?.linesAlive).toBe(1);
    expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_MINIFIED')).toBe(true);
  });

  it('throws ConflictingOptionsError when both rev and range are provided', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    await expect(
      analyze({ path: dir, rev: 'HEAD', range: { from: 'HEAD~1', to: 'HEAD' } }),
    ).rejects.toBeInstanceOf(ConflictingOptionsError);
  });

  it('analyzes at a specific tag with rev option', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'first line\n' },
      },
    ]);
    createdRepos.push(dir);

    // Tag the first commit as v1 before adding Bob's commit
    spawnSync('git', ['tag', 'v1'], { cwd: dir });

    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${dir}/a.txt`, 'first line\nBob line\n', 'utf8');
    spawnSync('git', ['add', 'a.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'bob adds line'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Bob',
        GIT_AUTHOR_EMAIL: 'b@x',
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_NAME: 'Bob',
        GIT_COMMITTER_EMAIL: 'b@x',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
      },
    });

    const report = await analyze({ path: dir, rev: 'v1' });

    // headRef should be 'v1' — we analyzed at the tag, not HEAD
    expect(report.repo.headRef).toBe('v1');
    // Blame at v1: only Alice's line exists (file had only 1 line at v1)
    const alice = report.authors.find((a) => a.email === 'a@x');
    expect(alice?.linesAlive).toBe(1);
    // Bob has no alive lines at v1 (his commit came after)
    expect(report.authors.find((a) => a.email === 'b@x')?.linesAlive).toBe(0);
  });

  it('counts only commits in range for linesAdded', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'first\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'middle\n' },
      },
      {
        author: 'Carol <c@x>',
        date: '2024-01-03T00:00:00Z',
        files: { 'c.txt': 'last\n' },
      },
    ]);
    createdRepos.push(dir);

    const logResult = spawnSync('git', ['log', '--format=%H', '--reverse'], {
      cwd: dir,
      encoding: 'utf8',
    });
    const shas = logResult.stdout.trim().split('\n');
    const firstSha = shas[0] ?? '';
    const secondSha = shas[1] ?? '';
    spawnSync('git', ['tag', 'v1', firstSha], { cwd: dir });
    spawnSync('git', ['tag', 'v2', secondSha], { cwd: dir });

    const report = await analyze({ path: dir, range: { from: 'v1', to: 'v2' } });

    // Only Bob's commit is in range v1..v2
    const bob = report.authors.find((a) => a.email === 'b@x');
    expect(bob?.linesAdded).toBe(1);
    // Alice has blame lines at v2 (her file exists) but no log commits in range → linesAdded=0
    expect(report.authors.find((a) => a.email === 'a@x')?.linesAdded).toBe(0);
    // Carol's file doesn't exist at v2 (her commit is after v2), so she's not in the report at all
    expect(report.authors.find((a) => a.email === 'c@x')).toBeUndefined();
    expect(report.repo.range).toEqual({
      fromSha: firstSha,
      toSha: secondSha,
      fromRef: 'v1',
      toRef: 'v2',
    });
  });

  it('filters log by since date', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'old\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-06-01T00:00:00Z',
        files: { 'b.txt': 'new\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, since: new Date('2024-03-01T00:00:00Z') });

    // Alice's commit predates the since cutoff — she has linesAdded=0 (blame still counts her lines alive)
    expect(report.authors.find((a) => a.email === 'a@x')?.linesAdded).toBe(0);
    // Bob's commit is after the cutoff, so his linesAdded is counted
    const bob = report.authors.find((a) => a.email === 'b@x');
    expect(bob?.linesAdded).toBe(1);
  });

  it('merges submodule stats when submodules is true', async () => {
    const { parentDir } = buildRepoWithSubmodule();
    createdRepos.push(parentDir);

    const report = await analyze({ path: parentDir, submodules: true });

    // Parent has ParentAuthor, submodule has LibAuthor — both should appear
    expect(report.authors.length).toBeGreaterThanOrEqual(2);
    const libAuthor = report.authors.find((a) => a.email === 'lib@example.com');
    expect(libAuthor).toBeDefined();
    expect(libAuthor?.linesAlive).toBeGreaterThan(0);
  });

  it('emits UNINIT_SUBMODULE warning for uninitialised submodules', async () => {
    const { parentDir, submoduleName } = buildRepoWithSubmodule();
    createdRepos.push(parentDir);

    // Deinit the submodule
    spawnSync('git', ['submodule', 'deinit', '-f', submoduleName], { cwd: parentDir });

    const report = await analyze({ path: parentDir, submodules: true });

    expect(report.warnings.some((w) => w.code === 'UNINIT_SUBMODULE')).toBe(true);
  });

  it('ignores submodules by default', async () => {
    const { parentDir } = buildRepoWithSubmodule();
    createdRepos.push(parentDir);

    const report = await analyze({ path: parentDir });

    const libAuthor = report.authors.find((a) => a.email === 'lib@example.com');
    expect(libAuthor).toBeUndefined();
  });

  it('returns cached result on second call with same options', async () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);

    const first = await analyze({ path: dir });
    expect(first.meta.cached).toBe(false);

    const second = await analyze({ path: dir });
    expect(second.meta.cached).toBe(true);
    expect(second.authors).toEqual(first.authors);
    expect(second.repo.headSha).toBe(first.repo.headSha);
  });

  it('skips cache when cache: false', async () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);

    await analyze({ path: dir });
    const second = await analyze({ path: dir, cache: false });
    expect(second.meta.cached).toBe(false);
  });

  it('skips cache on dirty worktree', async () => {
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);

    await analyze({ path: dir });
    writeFileSync(join(dir, 'a.txt'), 'modified\n', 'utf8');
    const second = await analyze({ path: dir });
    expect(second.meta.cached).toBe(false);
  });

  it('works in detached HEAD state', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
      {
        author: 'Alice <a@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'line two\n' },
      },
    ]);
    createdRepos.push(dir);

    const logResult = spawnSync('git', ['log', '--format=%H', '-1', 'HEAD~1'], {
      cwd: dir,
      encoding: 'utf8',
    });
    const parentSha = logResult.stdout.trim();
    spawnSync('git', ['checkout', parentSha], { cwd: dir, encoding: 'utf8' });

    const report = await analyze({ path: dir });

    expect(report.repo.headSha).toBe(parentSha);
    expect(report.authors.length).toBeGreaterThan(0);
  });

  it('reports zero linesAlive when all files are excluded by generated filter', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'package-lock.json': '{"lockfileVersion":3}\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    const totalLinesAlive = report.authors.reduce((sum, a) => sum + a.linesAlive, 0);
    expect(totalLinesAlive).toBe(0);
  });

  it('populates breakdown when groupBy extension is set', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.ts': 'line\n', 'b.css': 'style\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, groupBy: { type: 'extension', depth: 0 } });
    expect(report.breakdown).toBeDefined();
    expect(report.breakdown!.length).toBeGreaterThanOrEqual(2);

    const tsEntry = report.breakdown!.find((e) => e.group === '.ts');
    expect(tsEntry?.linesAlive).toBe(1);
    expect(tsEntry?.files).toBe(1);
  });

  it('populates breakdown when groupBy directory depth 1 is set', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'src/a.ts': 'line\n', 'cli/b.ts': 'line\n', 'root.txt': 'line\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir, groupBy: { type: 'directory', depth: 1 } });
    expect(report.breakdown).toBeDefined();

    const srcEntry = report.breakdown!.find((e) => e.group === 'src');
    const cliEntry = report.breakdown!.find((e) => e.group === 'cli');
    const rootEntry = report.breakdown!.find((e) => e.group === '(root)');
    expect(srcEntry?.linesAlive).toBe(1);
    expect(cliEntry?.linesAlive).toBe(1);
    expect(rootEntry?.linesAlive).toBe(1);
  });
});
