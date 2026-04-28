import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { detectOutputMode } from './detect-output-mode.js';

describe('detectOutputMode', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const dir of created.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns "stdout" when outputPath is undefined', () => {
    expect(detectOutputMode(undefined)).toBe('stdout');
  });

  it('returns "file" for a path that does not exist', () => {
    const fakePath = join(tmpdir(), `detect-${randomUUID()}.json`);
    expect(detectOutputMode(fakePath)).toBe('file');
  });

  it('returns "directory" when path ends with /', () => {
    expect(detectOutputMode('/some/dir/')).toBe('directory');
  });

  it('returns "directory" when path ends with backslash', () => {
    expect(detectOutputMode('C:\\some\\dir\\')).toBe('directory');
  });

  it('returns "directory" when path is an existing directory', () => {
    const dir = mkdtempSync(join(tmpdir(), `detect-${randomUUID()}-`));
    created.push(dir);
    expect(detectOutputMode(dir)).toBe('directory');
  });

  it('returns "file" for a non-existent path without trailing slash', () => {
    expect(detectOutputMode('/tmp/nonexistent-report.csv')).toBe('file');
  });
});
