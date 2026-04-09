import { describe, expect, it } from 'vitest';
import { InvalidRevError } from './invalid-rev.error.js';
import { NodeFameError } from './node-fame.error.js';

describe('InvalidRevError', () => {
  it('extends NodeFameError with code invalid_rev', () => {
    const err = new InvalidRevError('v99.0', '/my/repo');
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('invalid_rev');
    expect(err.rev).toBe('v99.0');
    expect(err.message).toContain('v99.0');
    expect(err.message).toContain('/my/repo');
    expect(err.name).toBe('InvalidRevError');
  });

  it('exposes cwd as a readable field', () => {
    const err = new InvalidRevError('v99.0', '/my/repo');
    expect(err.cwd).toBe('/my/repo');
  });
});
