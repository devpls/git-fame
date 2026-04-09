import { describe, expect, it } from 'vitest';
import { NodeFameError } from './node-fame.error.js';

describe('NodeFameError', () => {
  it('is a subclass of Error', () => {
    const err = new NodeFameError('boom', 'node_fame_error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NodeFameError);
  });

  it('carries message and code', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.message).toBe('boom');
    expect(err.code).toBe('my_code');
  });

  it('sets name to NodeFameError', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.name).toBe('NodeFameError');
  });
});
