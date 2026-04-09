import { describe, expect, it } from 'vitest';
import { parseFlags } from './parse-flags.js';

const base = ['node', 'node-fame'];

describe('parseFlags', () => {
  it('defaults to cwd when no path is given', () => {
    const { options } = parseFlags([...base]);
    expect(options.path).toBe(process.cwd());
  });

  it('takes path from the first positional argument', () => {
    const { options } = parseFlags([...base, '/my/repo']);
    expect(options.path).toBe('/my/repo');
  });

  it('sets include.whitespace when --include-whitespace is passed', () => {
    const { options } = parseFlags([...base, '--include-whitespace']);
    expect(options.include?.whitespace).toBe(true);
  });

  it('sets include.generated when --include-generated is passed', () => {
    const { options } = parseFlags([...base, '--include-generated']);
    expect(options.include?.generated).toBe(true);
  });

  it('disables followRenames with --no-follow-renames', () => {
    const { options } = parseFlags([...base, '--no-follow-renames']);
    expect(options.options?.followRenames).toBe(false);
  });

  it('disables mailmap with --no-mailmap', () => {
    const { options } = parseFlags([...base, '--no-mailmap']);
    expect(options.options?.applyMailmap).toBe(false);
  });

  it('passes include-globs as an array', () => {
    const { options } = parseFlags([...base, '--include-globs', '*.ts', '*.tsx']);
    expect(options.includeGlobs).toEqual(['*.ts', '*.tsx']);
  });

  it('passes exclude-globs as an array', () => {
    const { options } = parseFlags([...base, '--exclude-globs', 'vendor/**']);
    expect(options.excludeGlobs).toEqual(['vendor/**']);
  });

  it('sets minified to false with --exclude-minified', () => {
    const { options } = parseFlags([...base, '--exclude-minified']);
    expect(options.include?.minified).toBe(false);
  });

  it('defaults format to table', () => {
    const { format } = parseFlags([...base]);
    expect(format).toBe('table');
  });
});
