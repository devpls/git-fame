import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { version } from './version.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

describe('version', () => {
  it('matches the version in package.json', () => {
    expect(version).toBe(pkg.version);
  });

  it('follows semver format (major.minor.patch)', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
