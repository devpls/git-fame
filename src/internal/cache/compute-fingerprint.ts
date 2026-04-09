import { createHash } from 'node:crypto';

const CACHE_FORMAT_VERSION = '1';

export interface FingerprintInput {
  commitRef: string;
  since: string;
  until: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
  applyMailmap: boolean;
  includeGenerated: boolean;
  includeBinary: boolean;
  includeMinified: boolean;
  includeGlobs: readonly string[];
  excludeGlobs: readonly string[];
  mailmapContent: string;
  gitattributesContent: string;
}

export const computeFingerprint = (input: FingerprintInput): string => {
  const parts = [
    CACHE_FORMAT_VERSION,
    input.commitRef,
    input.since,
    input.until,
    String(input.followRenames),
    String(input.ignoreWhitespace),
    String(input.applyMailmap),
    String(input.includeGenerated),
    String(input.includeBinary),
    String(input.includeMinified),
    [...input.includeGlobs].sort().join('\0'),
    [...input.excludeGlobs].sort().join('\0'),
    input.mailmapContent,
    input.gitattributesContent,
  ];

  return createHash('sha256').update(parts.join('\n')).digest('hex');
};
