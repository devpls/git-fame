import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { listTrackedFiles } from './list-tracked-files.js';

describe('listTrackedFiles', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns an empty array for an empty repo', async () => {
    const dir = buildRepo([]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files).toEqual([]);
  });

  it('lists a single tracked file', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files).toEqual(['a.txt']);
  });

  it('lists multiple files including subdirectories', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: {
          'a.txt': 'x\n',
          'src/b.ts': 'export {};\n',
          'src/nested/c.ts': 'export {};\n',
        },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files.sort()).toEqual(['a.txt', 'src/b.ts', 'src/nested/c.ts']);
  });

  it('handles file names with unusual characters', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: {
          'normal.txt': 'x\n',
          'with spaces.txt': 'y\n',
          'unicode-файл.txt': 'z\n',
        },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files.sort()).toEqual(['normal.txt', 'unicode-файл.txt', 'with spaces.txt'].sort());
  });
});
