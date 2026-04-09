import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRepo } from '../helpers/build-repo.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = join(__dirname, '../../dist/cli/bin.js');

interface RunResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

const run = (args: string[], cwd?: string): RunResult => {
  const result = spawnSync('node', [BIN, ...args], {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf8',
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
};

describe('CLI e2e', () => {
  const createdDirs: string[] = [];

  beforeAll(() => {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: join(__dirname, '../..'),
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      throw new Error(`npm run build failed:\n${build.stderr}`);
    }
  });

  afterAll(() => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('--help exits 0 and lists all major flags', () => {
    const { stdout, status } = run(['--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('--format');
    expect(stdout).toContain('--include-globs');
    expect(stdout).toContain('--submodules');
    expect(stdout).toContain('--rev');
    expect(stdout).toContain('--sort');
  });

  it('--version exits 0 and prints semver', () => {
    const { stdout, status } = run(['--version']);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('valid repo exits 0 and stdout contains linesAlive and author name', () => {
    const dir = buildRepo([
      {
        author: 'Test Author <test@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'hello.txt': 'hello world\n' },
      },
    ]);
    createdDirs.push(dir);

    const { stdout, status } = run([dir]);
    expect(status).toBe(0);
    expect(stdout).toContain('linesAlive');
    expect(stdout).toContain('Test Author');
  });

  it('--format json exits 0 and stdout is valid JSON with meta.version', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'line one\n' },
      },
    ]);
    createdDirs.push(dir);

    const { stdout, status } = run(['--format', 'json', dir]);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { meta: { version: string } };
    expect(parsed.meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--format csv exits 0 and first line contains author,linesAlive', () => {
    const dir = buildRepo([
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'b.txt': 'bob line\n' },
      },
    ]);
    createdDirs.push(dir);

    const { stdout, status } = run(['--format', 'csv', dir]);
    expect(status).toBe(0);
    const firstLine = stdout.split('\n')[0] ?? '';
    expect(firstLine).toContain('author');
    expect(firstLine).toContain('linesAlive');
  });

  it('--format markdown exits 0 and contains | --- |', () => {
    const dir = buildRepo([
      {
        author: 'Carol <carol@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'c.txt': 'carol line\n' },
      },
    ]);
    createdDirs.push(dir);

    const { stdout, status } = run(['--format', 'markdown', dir]);
    expect(status).toBe(0);
    expect(stdout).toContain('| --- |');
  });

  it('non-existent path exits 1 and stderr mentions not a git repository', () => {
    const fakePath = join(tmpdir(), `node-fame-nonexistent-${randomUUID()}`);
    const { stderr, status } = run([fakePath]);
    expect(status).toBe(1);
    expect(stderr.toLowerCase()).toContain('not a git repository');
  });

  it('--sort commits --limit 1 exits 0', () => {
    const dir = buildRepo([
      {
        author: 'Dave <dave@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'd.txt': 'dave line\n' },
      },
    ]);
    createdDirs.push(dir);

    const { status } = run(['--sort', 'commits', '--limit', '1', dir]);
    expect(status).toBe(0);
  });

  it('--rev HEAD~1 exits 0 and stdout is valid JSON', () => {
    const dir = buildRepo([
      {
        author: 'Eve <eve@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'e.txt': 'eve first\n' },
      },
      {
        author: 'Eve <eve@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'e.txt': 'eve second\n' },
      },
    ]);
    createdDirs.push(dir);

    const { stdout, status } = run(['--format', 'json', '--rev', 'HEAD~1', dir]);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as unknown;
    expect(parsed).toBeDefined();
  });
});
