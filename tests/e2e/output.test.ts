import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../helpers/build-repo.js';

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

describe('--output e2e', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('--output file.json writes valid JSON to file', () => {
    const repoDir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.json');

    const { status, stderr } = run(['--output', outFile, repoDir]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(existsSync(outFile)).toBe(true);

    const raw = readFileSync(outFile, 'utf8');
    const parsed = JSON.parse(raw) as { meta: { version: string } };
    expect(parsed.meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--output file.csv writes CSV with correct header', () => {
    const repoDir = buildRepo([
      {
        author: 'Bob <bob@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'b.txt': 'world\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.csv');

    const { status, stderr } = run(['--output', outFile, repoDir]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(existsSync(outFile)).toBe(true);

    const raw = readFileSync(outFile, 'utf8');
    const firstLine = raw.split('\n')[0] ?? '';
    expect(firstLine).toContain('author');
    expect(firstLine).toContain('linesAlive');
  });

  it('--output file.txt --format table writes table format', () => {
    const repoDir = buildRepo([
      {
        author: 'Carol <carol@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'c.txt': 'line\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.txt');

    const { status, stderr } = run(['--output', outFile, '--format', 'table', repoDir]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(existsSync(outFile)).toBe(true);

    const raw = readFileSync(outFile, 'utf8');
    expect(raw).toContain('Carol');
    expect(raw).toContain('linesAlive');
  });

  it('format is inferred from .json extension without --format', () => {
    const repoDir = buildRepo([
      {
        author: 'Dave <dave@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'd.txt': 'data\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.json');

    const { status } = run(['--output', outFile, repoDir]);
    expect(status).toBe(0);

    const raw = readFileSync(outFile, 'utf8');
    const parsed = JSON.parse(raw) as { meta: { version: string } };
    expect(parsed.meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('format is inferred from .md extension without --format', () => {
    const repoDir = buildRepo([
      {
        author: 'Eve <eve@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'e.txt': 'content\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.md');

    const { status } = run(['--output', outFile, repoDir]);
    expect(status).toBe(0);

    const raw = readFileSync(outFile, 'utf8');
    expect(raw).toContain('| --- |');
  });

  it('unknown extension without --format exits non-zero with error message', () => {
    const repoDir = buildRepo([
      {
        author: 'Frank <frank@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'f.txt': 'hello\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.xyz');

    const { status, stderr } = run(['--output', outFile, repoDir]);
    expect(status).toBe(1);
    expect(stderr).toContain('format');
  });

  it('--output dir/ creates directory and writes file when --format is given', () => {
    const repoDir = buildRepo([
      {
        author: 'Grace <grace@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'g.txt': 'grace\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const targetDir = join(outDir, 'output') + '/';

    const { status, stderr } = run(['--output', targetDir, '--format', 'json', repoDir]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(existsSync(targetDir)).toBe(true);
  });

  it('--output dir/ without --format exits non-zero with error message', () => {
    const repoDir = buildRepo([
      {
        author: 'Henry <henry@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'h.txt': 'henry\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const targetDir = join(outDir, 'output') + '/';

    const { status, stderr } = run(['--output', targetDir, repoDir]);
    expect(status).toBe(1);
    expect(stderr).toContain('--format');
  });

  it('existing output file is overwritten', () => {
    const repoDir = buildRepo([
      {
        author: 'Iris <iris@example.com>',
        date: '2025-01-01T00:00:00Z',
        files: { 'i.txt': 'iris\n' },
      },
    ]);
    createdDirs.push(repoDir);

    const outDir = mkdtempSync(join(tmpdir(), `node-fame-out-${randomUUID()}-`));
    createdDirs.push(outDir);
    const outFile = join(outDir, 'report.csv');

    // Write once
    const { status: s1 } = run(['--output', outFile, repoDir]);
    expect(s1).toBe(0);
    const first = readFileSync(outFile, 'utf8');

    // Write again — same content expected, no error
    const { status: s2, stderr } = run(['--output', outFile, repoDir]);
    expect(stderr).toBe('');
    expect(s2).toBe(0);
    const second = readFileSync(outFile, 'utf8');
    expect(second).toBe(first);
  });
});
