import { describe, expect, it } from 'vitest';
import { ConflictingOptionsError } from './conflicting-options.error.js';
import { NodeFameError } from './node-fame.error.js';

describe('ConflictingOptionsError', () => {
  it('extends NodeFameError with code conflicting_options', () => {
    const err = new ConflictingOptionsError("'rev' and 'range' are mutually exclusive");
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('conflicting_options');
    expect(err.details).toBe("'rev' and 'range' are mutually exclusive");
    expect(err.name).toBe('ConflictingOptionsError');
  });
});
