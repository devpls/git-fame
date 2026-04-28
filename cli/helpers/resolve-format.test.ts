import { describe, expect, it } from 'vitest';
import { resolveFormat } from './resolve-format.js';

describe('resolveFormat', () => {
  it('returns flag format with source "flag" when flagFormat is provided', () => {
    const result = resolveFormat('csv', '/out/report.json', 'table');
    expect(result).toEqual({ format: 'csv', source: 'flag' });
  });

  it('infers json from .json extension', () => {
    const result = resolveFormat(undefined, '/out/report.json', undefined);
    expect(result).toEqual({ format: 'json', source: 'extension' });
  });

  it('infers csv from .csv extension', () => {
    const result = resolveFormat(undefined, '/out/report.csv', undefined);
    expect(result).toEqual({ format: 'csv', source: 'extension' });
  });

  it('infers markdown from .md extension', () => {
    const result = resolveFormat(undefined, '/out/report.md', undefined);
    expect(result).toEqual({ format: 'markdown', source: 'extension' });
  });

  it('infers markdown from .markdown extension', () => {
    const result = resolveFormat(undefined, '/out/report.markdown', undefined);
    expect(result).toEqual({ format: 'markdown', source: 'extension' });
  });

  it('infers table from .txt extension', () => {
    const result = resolveFormat(undefined, '/out/report.txt', undefined);
    expect(result).toEqual({ format: 'table', source: 'extension' });
  });

  it('throws on unknown extension', () => {
    expect(() => resolveFormat(undefined, '/out/report.xml', undefined)).toThrow(
      'cannot infer format from extension ".xml"; use --format',
    );
  });

  it('falls back to config format when output has no extension', () => {
    const result = resolveFormat(undefined, '/out/mydir/', 'json');
    expect(result).toEqual({ format: 'json', source: 'config' });
  });

  it('returns config format with source "config" when no flag or extension', () => {
    const result = resolveFormat(undefined, undefined, 'markdown');
    expect(result).toEqual({ format: 'markdown', source: 'config' });
  });

  it('returns default table when nothing is provided', () => {
    const result = resolveFormat(undefined, undefined, undefined);
    expect(result).toEqual({ format: 'table', source: 'default' });
  });

  it('flag takes priority over extension and config', () => {
    const result = resolveFormat('markdown', '/out/report.json', 'csv');
    expect(result).toEqual({ format: 'markdown', source: 'flag' });
  });

  it('extension takes priority over config', () => {
    const result = resolveFormat(undefined, '/out/report.csv', 'json');
    expect(result).toEqual({ format: 'csv', source: 'extension' });
  });

  it('handles case-insensitive extensions', () => {
    const result = resolveFormat(undefined, '/out/report.JSON', undefined);
    expect(result).toEqual({ format: 'json', source: 'extension' });
  });
});
