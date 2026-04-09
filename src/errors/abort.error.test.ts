import { describe, expect, it } from 'vitest';
import { AbortError } from './abort.error.js';
import { NodeFameError } from './node-fame.error.js';

describe('AbortError', () => {
  it('extends NodeFameError with code aborted', () => {
    const err = new AbortError();
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('aborted');
    expect(err.name).toBe('AbortError');
  });

  it('accepts a custom message', () => {
    const err = new AbortError('user cancelled');
    expect(err.message).toBe('user cancelled');
  });
});
