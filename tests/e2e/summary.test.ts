import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = join(__dirname, '../../dist/cli/bin.js');

interface RunResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

const run = (args: string[]): RunResult => {
  const result = spawnSync('node', [BIN, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
};

const createRepoAt = (dir: string, files: Record<string, string>, author: string): void => {
  mkdirSync(dir, { recursive: true });

  const gitArgs = [
    ['init', '--initial-branch=main'],
    ['config', 'user.email', 'test@test.com'],
    ['config', 'user.name', 'Test'],
    ['config', 'commit.gpgsign', 'false'],
  ];
  for (const args of gitArgs) {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
  }

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }

  const addResult = spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
  if (addResult.status !== 0) {
    throw new Error(`git add -A failed: ${addResult.stderr}`);
  }

  const commitResult = spawnSync('git', ['commit', '-m', 'init', `--author=${author}`], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2025-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2025-01-01T00:00:00Z',
    },
  });
  if (commitResult.status !== 0) {
    throw new Error(`git commit failed: ${commitResult.stderr}`);
  }
};

describe('--summary e2e', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('--summary without --recursive exits non-zero with error message', () => {
    const parentDir = mkdtempSync(join(tmpdir(), `node-fame-summary-${randomUUID()}-`));
    createdDirs.push(parentDir);
    createRepoAt(join(parentDir, 'repo1'), { 'a.txt': 'hello\n' }, 'Alice <alice@x.com>');

    const { status, stderr } = run(['--summary', join(parentDir, 'repo1')]);
    expect(status).toBe(1);
    expect(stderr).toContain('--recursive');
  });

  it('--recursive --summary --format table outputs per-repo sections and summary section', () => {
    const parentDir = mkdtempSync(join(tmpdir(), `node-fame-summary-${randomUUID()}-`));
    createdDirs.push(parentDir);
    createRepoAt(join(parentDir, 'repo1'), { 'a.txt': 'hello\n' }, 'Alice <alice@x.com>');
    createRepoAt(join(parentDir, 'repo2'), { 'b.txt': 'world\n' }, 'Bob <bob@x.com>');

    const { stdout, stderr, status } = run([
      '--recursive',
      '--summary',
      '--format',
      'table',
      parentDir,
    ]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('=== ');
    expect(stdout).toContain('Summary (2 repos)');
    expect(stdout).toContain('Alice');
    expect(stdout).toContain('Bob');
  });

  it('--recursive --summary --format json outputs per-repo sections and summary section', () => {
    const parentDir = mkdtempSync(join(tmpdir(), `node-fame-summary-${randomUUID()}-`));
    createdDirs.push(parentDir);
    createRepoAt(join(parentDir, 'repo1'), { 'a.txt': 'hello\n' }, 'Alice <alice@x.com>');
    createRepoAt(join(parentDir, 'repo2'), { 'b.txt': 'world\n' }, 'Bob <bob@x.com>');

    const { stdout, stderr, status } = run([
      '--recursive',
      '--summary',
      '--format',
      'json',
      parentDir,
    ]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('"repoCount"');
    expect(stdout).toContain('"authors"');
  });

  it('--recursive --summary --format csv outputs per-repo sections and summary CSV section', () => {
    const parentDir = mkdtempSync(join(tmpdir(), `node-fame-summary-${randomUUID()}-`));
    createdDirs.push(parentDir);
    createRepoAt(join(parentDir, 'repo1'), { 'a.txt': 'hello\n' }, 'Alice <alice@x.com>');
    createRepoAt(join(parentDir, 'repo2'), { 'b.txt': 'world\n' }, 'Bob <bob@x.com>');

    const { stdout, stderr, status } = run([
      '--recursive',
      '--summary',
      '--format',
      'csv',
      parentDir,
    ]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('section,author,repo,linesAlive');
  });

  it('--recursive without --summary still outputs per-repo sections', () => {
    const parentDir = mkdtempSync(join(tmpdir(), `node-fame-summary-${randomUUID()}-`));
    createdDirs.push(parentDir);
    createRepoAt(join(parentDir, 'repo1'), { 'a.txt': 'hello\n' }, 'Alice <alice@x.com>');
    createRepoAt(join(parentDir, 'repo2'), { 'b.txt': 'world\n' }, 'Bob <bob@x.com>');

    const { stdout, stderr, status } = run(['--recursive', '--format', 'table', parentDir]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('=== ');
    expect(stdout).not.toContain('=== Summary ===');
    expect(stdout).toContain('Alice');
    expect(stdout).toContain('Bob');
  });
});
