import { describe, expect, it } from 'vitest';
import { matchesUserGlobs } from './matches-user-globs.js';

describe('matchesUserGlobs', () => {
  it('returns true when no globs are provided', () => {
    expect(matchesUserGlobs('any/file.ts', [], [])).toBe(true);
  });

  it('includes files matching includeGlobs', () => {
    expect(matchesUserGlobs('src/index.ts', ['*.ts'], [])).toBe(true);
  });

  it('excludes files not matching includeGlobs', () => {
    expect(matchesUserGlobs('src/style.css', ['*.ts'], [])).toBe(false);
  });

  it('excludes files matching excludeGlobs', () => {
    expect(matchesUserGlobs('vendor/lib.ts', [], ['vendor/**'])).toBe(false);
  });

  it('exclude wins over include when both match', () => {
    expect(matchesUserGlobs('vendor/lib.ts', ['*.ts'], ['vendor/**'])).toBe(false);
  });

  it('handles deep paths with ** include patterns', () => {
    expect(matchesUserGlobs('src/deep/nested/file.tsx', ['**/*.tsx'], [])).toBe(true);
  });

  it('supports multiple include patterns (OR logic)', () => {
    expect(matchesUserGlobs('style.css', ['*.ts', '*.css'], [])).toBe(true);
    expect(matchesUserGlobs('readme.md', ['*.ts', '*.css'], [])).toBe(false);
  });

  it('supports multiple exclude patterns (OR logic)', () => {
    expect(matchesUserGlobs('test.snap', [], ['*.snap', '*.log'])).toBe(false);
    expect(matchesUserGlobs('test.ts', [], ['*.snap', '*.log'])).toBe(true);
  });
});
