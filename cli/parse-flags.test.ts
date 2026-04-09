import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
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

  it('passes --sort as renderOptions.sort.by', () => {
    const { renderOptions } = parseFlags([...base, '--sort', 'commits']);
    expect(renderOptions.sort?.by).toBe('commits');
  });

  it('passes --limit as renderOptions.limit', () => {
    const { renderOptions } = parseFlags([...base, '--limit', '5']);
    expect(renderOptions.limit).toBe(5);
  });

  it('sets submodules flag', () => {
    const { options } = parseFlags([...base, '--submodules']);
    expect(options.submodules).toBe(true);
  });

  it('sets recursive flag', () => {
    const { recursive } = parseFlags([...base, '--recursive']);
    expect(recursive).toBe(true);
  });

  it('sets splitSubmodules and implies submodules', () => {
    const result = parseFlags([...base, '--split-submodules']);
    expect(result.splitSubmodules).toBe(true);
    expect(result.options.submodules).toBe(true);
  });

  describe('config file integration', () => {
    const created: string[] = [];

    afterEach(() => {
      for (const dir of created.splice(0)) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    });

    it('loads .node-famerc config values', () => {
      const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
      created.push(dir);
      writeFileSync(
        join(dir, '.node-famerc'),
        JSON.stringify({ format: 'json', includeGlobs: ['**/*.ts'], concurrency: 4 }),
        'utf8',
      );

      const result = parseFlags(['node', 'cli', dir]);
      expect(result.format).toBe('json');
      expect(result.options.includeGlobs).toEqual(['**/*.ts']);
      expect(result.options.concurrency).toBe(4);
    });

    it('CLI flags override .node-famerc', () => {
      const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
      created.push(dir);
      writeFileSync(
        join(dir, '.node-famerc'),
        JSON.stringify({ format: 'json', concurrency: 4 }),
        'utf8',
      );

      const result = parseFlags(['node', 'cli', '--format', 'csv', '--concurrency', '8', dir]);
      expect(result.format).toBe('csv');
      expect(result.options.concurrency).toBe(8);
    });
  });
});
