import type { PartialBlameLine } from '../types/partial-blame-line.type.js';

export const beginNewEntry = (state: PartialBlameLine | null, sha: string): PartialBlameLine => {
  if (state !== null) {
    throw new Error('parseBlamePorcelain: header line arrived before previous entry finished');
  }
  return { sha, isBoundary: false };
};
