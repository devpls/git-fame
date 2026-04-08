import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { collectStream } from './collect-stream.js';

describe('collectStream', () => {
  it('joins string chunks into a single string', async () => {
    const stream = Readable.from(['hello ', 'world']);
    const result = await collectStream(stream);
    expect(result).toBe('hello world');
  });

  it('joins Buffer chunks into a single string', async () => {
    const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
    const result = await collectStream(stream);
    expect(result).toBe('hello world');
  });

  it('returns empty string for an empty stream', async () => {
    const stream = Readable.from([]);
    const result = await collectStream(stream);
    expect(result).toBe('');
  });

  it('handles UTF-8 multibyte sequences across chunks', async () => {
    const full = Buffer.from('привет', 'utf8');
    const first = full.subarray(0, 3);
    const second = full.subarray(3);
    const stream = Readable.from([first, second]);
    const result = await collectStream(stream);
    expect(result).toBe('привет');
  });
});
