import { describe, expect, it } from 'vitest';
import type { PartialBlameLine } from '../types/partial-blame-line.type.js';
import { applyMetadataLine } from './apply-metadata-line.js';

const makeState = (): PartialBlameLine => ({
  sha: 'a'.repeat(40),
  isBoundary: false,
});

describe('applyMetadataLine', () => {
  it('sets authorName from an author line', () => {
    const state = makeState();
    applyMetadataLine(state, 'author Alice');
    expect(state.authorName).toBe('Alice');
  });

  it('sets authorMail and strips angle brackets', () => {
    const state = makeState();
    applyMetadataLine(state, 'author-mail <alice@example.com>');
    expect(state.authorMail).toBe('alice@example.com');
  });

  it('parses authorTime as a number', () => {
    const state = makeState();
    applyMetadataLine(state, 'author-time 1704067200');
    expect(state.authorTime).toBe(1704067200);
  });

  it('sets isBoundary when the line is exactly "boundary"', () => {
    const state = makeState();
    applyMetadataLine(state, 'boundary');
    expect(state.isBoundary).toBe(true);
  });

  it('ignores committer-* lines', () => {
    const state = makeState();
    applyMetadataLine(state, 'committer Bob');
    expect(state.authorName).toBeUndefined();
  });

  it('ignores author-tz lines', () => {
    const state = makeState();
    applyMetadataLine(state, 'author-tz +0300');
    expect(state).toStrictEqual({ sha: 'a'.repeat(40), isBoundary: false });
  });

  it('ignores summary and filename lines', () => {
    const state = makeState();
    applyMetadataLine(state, 'summary Initial commit');
    applyMetadataLine(state, 'filename a.txt');
    expect(state).toStrictEqual({ sha: 'a'.repeat(40), isBoundary: false });
  });
});
