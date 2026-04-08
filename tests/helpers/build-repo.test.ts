import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildRepo, cleanupRepo } from './build-repo.js';

describe('buildRepo', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('creates a git repository in a fresh temp directory', () => {
    const dir = buildRepo([]);
    created.push(dir);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, '.git'))).toBe(true);
  });

  it('applies the requested files in a commit', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n' },
      },
    ]);
    created.push(dir);

    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('hello\n');

    const log = spawnSync('git', ['log', '--pretty=%an|%ae|%aI'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(log.status).toBe(0);
    expect(log.stdout.trim()).toBe('Alice|alice@example.com|2024-01-01T00:00:00Z');
  });

  it('supports multiple commits with different authors and dates', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'two\n' },
      },
    ]);
    created.push(dir);

    const log = spawnSync('git', ['log', '--pretty=%an'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(log.stdout.trim().split('\n')).toEqual(['Bob', 'Alice']);
  });

  it('supports deleting files in subsequent commits', () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'gone.txt': 'delete me\n' },
      },
      {
        author: 'Alice <a@x>',
        date: '2024-01-02T00:00:00Z',
        delete: ['gone.txt'],
      },
    ]);
    created.push(dir);
    expect(existsSync(join(dir, 'gone.txt'))).toBe(false);
  });

  it('throws on invalid author format', () => {
    expect(() =>
      buildRepo([
        {
          author: 'no-email-format',
          date: '2024-01-01T00:00:00Z',
          files: { 'a.txt': 'x\n' },
        },
      ]),
    ).toThrow(/author/i);
  });

  it('cleanupRepo removes the directory', () => {
    const dir = buildRepo([]);
    expect(existsSync(dir)).toBe(true);
    cleanupRepo(dir);
    expect(existsSync(dir)).toBe(false);
  });
});
