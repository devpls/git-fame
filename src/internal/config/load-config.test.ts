import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('returns empty object when .gitfamerc does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    expect(loadConfig(dir)).toEqual({});
  });

  it('parses valid JSON config', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(
      join(dir, '.gitfamerc'),
      JSON.stringify({
        format: 'json',
        sort: 'commits',
        limit: 5,
        includeGlobs: ['**/*.ts'],
        followRenames: false,
      }),
      'utf8',
    );

    const config = loadConfig(dir);
    expect(config.format).toBe('json');
    expect(config.sort).toBe('commits');
    expect(config.limit).toBe(5);
    expect(config.includeGlobs).toEqual(['**/*.ts']);
    expect(config.followRenames).toBe(false);
  });

  it('throws on malformed JSON with descriptive message', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(join(dir, '.gitfamerc'), '{bad json', 'utf8');
    expect(() => loadConfig(dir)).toThrow('Failed to parse .gitfamerc');
  });

  it('ignores unknown fields', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(
      join(dir, '.gitfamerc'),
      JSON.stringify({
        format: 'csv',
        unknownField: 42,
        anotherUnknown: true,
      }),
      'utf8',
    );

    const config = loadConfig(dir);
    expect(config.format).toBe('csv');
    expect(config).not.toHaveProperty('unknownField');
    expect(config).not.toHaveProperty('anotherUnknown');
  });

  it('returns empty object for empty JSON object', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(join(dir, '.gitfamerc'), '{}', 'utf8');
    expect(loadConfig(dir)).toEqual({});
  });
});
