import { describe, expect, it } from 'vitest';
import { version } from '../../src/index';

describe('node-fame package entry', () => {
  it('exports a version string', () => {
    expect(typeof version).toBe('string');
  });

  it('version follows semver format (major.minor.patch)', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
