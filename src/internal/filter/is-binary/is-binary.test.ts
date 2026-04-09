import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isBinary } from './is-binary.js';

describe('isBinary', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeFile = (name: string, content: Buffer | string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-binary-'));
    created.push(dir);
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };

  it('returns false for a plain UTF-8 text file', () => {
    const path = makeFile('text.txt', 'hello world\nline two\n');
    expect(isBinary(path)).toBe(false);
  });

  it('returns true for a file containing a NUL byte within the first 8 KB', () => {
    const path = makeFile('binary.bin', Buffer.from([0x48, 0x69, 0x00, 0x00, 0x01, 0x02]));
    expect(isBinary(path)).toBe(true);
  });

  it('returns false for an empty file', () => {
    const path = makeFile('empty.txt', '');
    expect(isBinary(path)).toBe(false);
  });

  it('returns false for non-ASCII UTF-8 content', () => {
    const path = makeFile('cyr.txt', 'строка с юникодом\n');
    expect(isBinary(path)).toBe(false);
  });

  it('returns true when the NUL byte is at the very start', () => {
    const path = makeFile('nul-first.bin', Buffer.from([0x00, 0x48, 0x69]));
    expect(isBinary(path)).toBe(true);
  });
});
