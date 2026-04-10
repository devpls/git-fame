import { describe, expect, it } from 'vitest';
import { compileMatchers, matchesUserGlobs } from './matches-user-globs.js';

describe('matchesUserGlobs', () => {
  it('returns true when no globs are provided', () => {
    expect(matchesUserGlobs('any/file.ts', compileMatchers([]), compileMatchers([]))).toBe(true);
  });

  it('includes files matching includeGlobs', () => {
    expect(matchesUserGlobs('src/index.ts', compileMatchers(['*.ts']), compileMatchers([]))).toBe(
      true,
    );
  });

  it('excludes files not matching includeGlobs', () => {
    expect(matchesUserGlobs('src/style.css', compileMatchers(['*.ts']), compileMatchers([]))).toBe(
      false,
    );
  });

  it('excludes files matching excludeGlobs', () => {
    expect(
      matchesUserGlobs('vendor/lib.ts', compileMatchers([]), compileMatchers(['vendor/**'])),
    ).toBe(false);
  });

  it('exclude wins over include when both match', () => {
    expect(
      matchesUserGlobs('vendor/lib.ts', compileMatchers(['*.ts']), compileMatchers(['vendor/**'])),
    ).toBe(false);
  });

  it('handles deep paths with ** include patterns', () => {
    expect(
      matchesUserGlobs(
        'src/deep/nested/file.tsx',
        compileMatchers(['**/*.tsx']),
        compileMatchers([]),
      ),
    ).toBe(true);
  });

  it('supports multiple include patterns (OR logic)', () => {
    expect(
      matchesUserGlobs('style.css', compileMatchers(['*.ts', '*.css']), compileMatchers([])),
    ).toBe(true);
    expect(
      matchesUserGlobs('readme.md', compileMatchers(['*.ts', '*.css']), compileMatchers([])),
    ).toBe(false);
  });

  it('supports multiple exclude patterns (OR logic)', () => {
    expect(
      matchesUserGlobs('test.snap', compileMatchers([]), compileMatchers(['*.snap', '*.log'])),
    ).toBe(false);
    expect(
      matchesUserGlobs('test.ts', compileMatchers([]), compileMatchers(['*.snap', '*.log'])),
    ).toBe(true);
  });
});
