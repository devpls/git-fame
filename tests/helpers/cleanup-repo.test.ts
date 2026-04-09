import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRepo } from './build-repo.js';
import { cleanupRepo } from './cleanup-repo.js';

describe('cleanupRepo', () => {
  it('removes the directory recursively', () => {
    const dir = buildRepo([]);
    expect(existsSync(dir)).toBe(true);
    cleanupRepo(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('is a no-op on a path that does not exist', () => {
    expect(() => {
      cleanupRepo('/path/that/does/not/exist/ever-1234');
    }).not.toThrow();
  });
});
