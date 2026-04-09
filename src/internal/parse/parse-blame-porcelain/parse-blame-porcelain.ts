import { applyMetadataLine } from './helpers/apply-metadata-line.js';
import { beginNewEntry } from './helpers/begin-new-entry.js';
import { finaliseContentLine } from './helpers/finalise-content-line.js';
import type { BlameLine } from './types/blame-line.type.js';
import type { PartialBlameLine } from './types/partial-blame-line.type.js';

interface CachedBlameInfo {
  authorName: string;
  authorMail: string;
  authorTime: number;
  isBoundary: boolean;
}

const HEADER_REGEX = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/;

export const parseBlamePorcelain = (output: string): BlameLine[] => {
  const cache = new Map<string, CachedBlameInfo>();
  const results: BlameLine[] = [];
  let state: PartialBlameLine | null = null;
  let cachedEntry: CachedBlameInfo | undefined;

  for (const raw of output.split('\n')) {
    if (raw.length === 0) {
      continue;
    }

    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (line.startsWith('\t')) {
      if (cachedEntry !== undefined) {
        const entry = cachedEntry;
        cachedEntry = undefined;
        results.push({
          sha: state?.sha ?? '',
          authorName: entry.authorName,
          authorMail: entry.authorMail,
          authorTime: entry.authorTime,
          line: line.slice(1),
          isBoundary: entry.isBoundary,
        });
        state = null;
        continue;
      }
      const blameLine = finaliseContentLine(state, line);
      cache.set(blameLine.sha, {
        authorName: blameLine.authorName,
        authorMail: blameLine.authorMail,
        authorTime: blameLine.authorTime,
        isBoundary: blameLine.isBoundary,
      });
      state = null;
      results.push(blameLine);
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(line);
    if (headerMatch !== null) {
      const sha = headerMatch[1] ?? '';
      const cached = cache.get(sha);
      if (cached !== undefined) {
        if (state !== null) {
          throw new Error(
            'parseBlamePorcelain: header line arrived before previous entry finished',
          );
        }
        state = { sha, isBoundary: cached.isBoundary };
        cachedEntry = cached;
        continue;
      }
      state = beginNewEntry(state, sha);
      continue;
    }

    if (line.startsWith('filename ')) {
      // skip — not needed for output
      continue;
    }

    if (state === null) {
      throw new Error(`parseBlamePorcelain: unexpected line outside of a block: ${line}`);
    }

    applyMetadataLine(state, line);
  }

  if (state !== null) {
    throw new Error('parseBlamePorcelain: unexpected end of stream in the middle of a block');
  }

  return results;
};
