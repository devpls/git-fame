import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isMinified } from './is-minified.js';

describe('isMinified', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeFile = (name: string, content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-minified-'));
    created.push(dir);
    const path = join(dir, name);
    writeFileSync(path, content, 'utf8');
    return path;
  };

  it('returns false for a normal source file', () => {
    const path = makeFile('a.ts', 'const x = 1;\nconst y = 2;\nconst z = 3;\n');
    expect(isMinified(path)).toBe(false);
  });

  it('returns true for a single-line file with avg length > 500', () => {
    const longLine = 'a'.repeat(1000) + '\n';
    const path = makeFile('bundle.min.js', longLine);
    expect(isMinified(path)).toBe(true);
  });

  it('returns true when average line length exceeds threshold', () => {
    const lines = Array.from({ length: 10 }, () => 'x'.repeat(600)).join('\n') + '\n';
    const path = makeFile('packed.js', lines);
    expect(isMinified(path)).toBe(true);
  });

  it('returns false for an empty file', () => {
    const path = makeFile('empty.js', '');
    expect(isMinified(path)).toBe(false);
  });

  it('returns false when lines are long but below threshold', () => {
    const lines = Array.from({ length: 5 }, () => 'y'.repeat(200)).join('\n') + '\n';
    const path = makeFile('long-but-ok.ts', lines);
    expect(isMinified(path)).toBe(false);
  });
});
