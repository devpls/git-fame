import { createInterface } from 'node:readline';
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

export async function* parseBlamePorcelain(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<BlameLine> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const cache = new Map<string, CachedBlameInfo>();
  let state: PartialBlameLine | null = null;
  let cachedEntry: CachedBlameInfo | undefined;

  for await (const raw of rl) {
    if (raw.startsWith('\t')) {
      if (cachedEntry !== undefined) {
        const entry = cachedEntry;
        cachedEntry = undefined;
        yield {
          sha: state?.sha ?? '',
          authorName: entry.authorName,
          authorMail: entry.authorMail,
          authorTime: entry.authorTime,
          line: raw.slice(1),
          isBoundary: entry.isBoundary,
        };
        state = null;
        continue;
      }
      const line = finaliseContentLine(state, raw);
      cache.set(line.sha, {
        authorName: line.authorName,
        authorMail: line.authorMail,
        authorTime: line.authorTime,
        isBoundary: line.isBoundary,
      });
      state = null;
      yield line;
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(raw);
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

    if (raw.startsWith('filename ')) {
      // skip — not needed for output
      continue;
    }

    if (state === null) {
      throw new Error(`parseBlamePorcelain: unexpected line outside of a block: ${raw}`);
    }

    applyMetadataLine(state, raw);
  }

  if (state !== null) {
    throw new Error('parseBlamePorcelain: unexpected end of stream in the middle of a block');
  }
}
