import { describe, expect, it } from 'vitest';
import { computeFingerprint } from './compute-fingerprint.js';
import type { FingerprintInput } from './compute-fingerprint.js';

const baseInput: FingerprintInput = {
  commitRef: 'abc123',
  since: '',
  until: '',
  followRenames: true,
  ignoreWhitespace: true,
  applyMailmap: true,
  includeGenerated: false,
  includeBinary: false,
  includeMinified: true,
  includeGlobs: [],
  excludeGlobs: [],
  mailmapContent: '',
  gitattributesContent: '',
};

describe('computeFingerprint', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const fp = computeFingerprint(baseInput);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint(baseInput);
    expect(a).toBe(b);
  });

  it('different commitRef produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, commitRef: 'def456' });
    expect(a).not.toBe(b);
  });

  it('different followRenames produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, followRenames: false });
    expect(a).not.toBe(b);
  });

  it('glob order does not affect fingerprint', () => {
    const a = computeFingerprint({ ...baseInput, includeGlobs: ['*.ts', '*.tsx'] });
    const b = computeFingerprint({ ...baseInput, includeGlobs: ['*.tsx', '*.ts'] });
    expect(a).toBe(b);
  });

  it('different mailmap content produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, mailmapContent: 'Proper Name <a@x> <old@x>' });
    expect(a).not.toBe(b);
  });

  it('different since date produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, since: '2024-01-01T00:00:00.000Z' });
    expect(a).not.toBe(b);
  });
});
