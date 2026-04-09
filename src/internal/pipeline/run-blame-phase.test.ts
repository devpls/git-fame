import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { runBlamePhase } from './run-blame-phase.js';

describe('runBlamePhase', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('records linesAlive for every blame line across files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\nthree\n', 'b.txt': 'single\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'b.txt'], agg, {
      rev: 'HEAD',
      followRenames: true,
      ignoreWhitespace: true,
    });

    const stats = agg.getStatsForTesting().get('a@x');
    expect(stats?.linesAlive).toBe(4);
  });

  it('attributes lines to the current owner after a rewrite', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt'], agg, {
      rev: 'HEAD',
      followRenames: true,
      ignoreWhitespace: true,
    });

    const stats = agg.getStatsForTesting();
    expect(stats.get('a@x')?.linesAlive).toBe(1);
    expect(stats.get('b@x')?.linesAlive).toBe(1);
  });

  it('emits BLAME_FAILED warning for missing files without throwing', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'does-not-exist.txt'], agg, {
      rev: 'HEAD',
      followRenames: true,
      ignoreWhitespace: true,
    });

    expect(agg.getStatsForTesting().get('a@x')?.linesAlive).toBe(1);
    const warnings = agg.getWarningsForTesting();
    expect(warnings.some((w) => w.code === 'BLAME_FAILED')).toBe(true);
  });

  it('is a no-op when the file list is empty', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, [], agg, { rev: 'HEAD', followRenames: true, ignoreWhitespace: true });
    expect(agg.getStatsForTesting().size).toBe(0);
  });

  it('attributes whitespace-only edits to the original author when ignoreWhitespace is true', async () => {
    const { spawnSync } = await import('node:child_process');

    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'function foo() {\n  return 1;\n}\n' },
      },
    ]);
    createdRepos.push(dir);

    // Bob only changes indentation (whitespace-only edit)
    writeFileSync(join(dir, 'a.txt'), 'function foo() {\n    return 1;\n}\n', 'utf8');
    spawnSync('git', ['add', 'a.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'indent change'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Bot',
        GIT_AUTHOR_EMAIL: 'bot@x',
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_NAME: 'Bot',
        GIT_COMMITTER_EMAIL: 'bot@x',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
      },
    });

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt'], agg, {
      rev: 'HEAD',
      followRenames: false,
      ignoreWhitespace: true,
    });

    const stats = agg.getStatsForTesting();
    // With -w, Alice should still own all 3 lines
    expect(stats.get('a@x')?.linesAlive).toBe(3);
    expect(stats.get('bot@x')?.linesAlive).toBeUndefined();
  });

  it('attributes whitespace edits to the bot when ignoreWhitespace is false', async () => {
    const { spawnSync } = await import('node:child_process');

    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'function foo() {\n  return 1;\n}\n' },
      },
    ]);
    createdRepos.push(dir);

    // Bot only changes indentation (whitespace-only edit)
    writeFileSync(join(dir, 'a.txt'), 'function foo() {\n    return 1;\n}\n', 'utf8');
    spawnSync('git', ['add', 'a.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'indent change'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Bot',
        GIT_AUTHOR_EMAIL: 'bot@x',
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_NAME: 'Bot',
        GIT_COMMITTER_EMAIL: 'bot@x',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
      },
    });

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt'], agg, {
      rev: 'HEAD',
      followRenames: false,
      ignoreWhitespace: false,
    });

    const stats = agg.getStatsForTesting();
    // Without -w, Bot owns the indentation-changed line (only "  return 1;" changed to "    return 1;")
    expect(stats.get('bot@x')?.linesAlive).toBe(1);
    expect(stats.get('a@x')?.linesAlive).toBe(2);
  });

  it('follows renames when followRenames is true', async () => {
    const { spawnSync } = await import('node:child_process');

    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'old.txt': 'line one\nline two\n' },
      },
    ]);
    createdRepos.push(dir);

    // Bot renames the file without content changes
    spawnSync('git', ['mv', 'old.txt', 'new.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'rename file'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Bot',
        GIT_AUTHOR_EMAIL: 'bot@x',
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_NAME: 'Bot',
        GIT_COMMITTER_EMAIL: 'bot@x',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
      },
    });

    const agg = new Aggregator();
    await runBlamePhase(dir, ['new.txt'], agg, {
      rev: 'HEAD',
      followRenames: true,
      ignoreWhitespace: false,
    });

    const stats = agg.getStatsForTesting();
    // With -M -C, Alice should own both lines (she wrote the content)
    expect(stats.get('a@x')?.linesAlive).toBe(2);
    expect(stats.get('bot@x')?.linesAlive).toBeUndefined();
  });

  it('calls onProgress after each file', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\n', 'b.txt': 'two\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    const events: { done: number; total: number }[] = [];
    await runBlamePhase(
      dir,
      ['a.txt', 'b.txt'],
      agg,
      { rev: 'HEAD', followRenames: true, ignoreWhitespace: true },
      (ev) => {
        if (ev.type === 'blame') events.push({ done: ev.done, total: ev.total });
      },
    );

    expect(events).toEqual([
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
  });

  it('blames at a specific tag revision', async () => {
    const { spawnSync } = await import('node:child_process');

    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'first line\n' },
      },
    ]);
    createdRepos.push(dir);

    // Tag first commit as v1
    spawnSync('git', ['tag', 'v1'], { cwd: dir });

    // Make a second commit by Bob
    writeFileSync(join(dir, 'a.txt'), 'first line\nsecond line\n', 'utf8');
    spawnSync('git', ['add', 'a.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'add second line'], {
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

    const agg = new Aggregator();
    // Blame at v1 — only the first commit's state exists there
    await runBlamePhase(dir, ['a.txt'], agg, {
      rev: 'v1',
      followRenames: false,
      ignoreWhitespace: false,
    });

    const stats = agg.getStatsForTesting();
    expect(stats.get('a@x')?.linesAlive).toBe(1);
    expect(stats.has('b@x')).toBe(false);
  });
});
