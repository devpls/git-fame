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

  it('passes --rev as options.rev', () => {
    const { options } = parseFlags([...base, '--rev', 'v1.0', '/path']);
    expect(options.rev).toBe('v1.0');
  });

  it('builds range from --from and --to', () => {
    const { options } = parseFlags([...base, '--from', 'v1', '--to', 'v2', '/path']);
    expect(options.range).toEqual({ from: 'v1', to: 'v2' });
  });

  it('parses --since as a Date', () => {
    const { options } = parseFlags([...base, '--since', '2024-01-01']);
    expect(options.since).toBeInstanceOf(Date);
  });

  it('parses --until as a Date', () => {
    const { options } = parseFlags([...base, '--until', '2024-12-31']);
    expect(options.until).toBeInstanceOf(Date);
  });

  it('leaves range undefined when only --from is provided', () => {
    const { options } = parseFlags([...base, '--from', 'v1']);
    expect(options.range).toBeUndefined();
  });
});
