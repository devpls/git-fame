import { createInterface } from 'node:readline';
import { applyMetadataLine } from './helpers/apply-metadata-line.js';
import { beginNewEntry } from './helpers/begin-new-entry.js';
import { finaliseContentLine } from './helpers/finalise-content-line.js';
import type { BlameLine } from './types/blame-line.type.js';
import type { PartialBlameLine } from './types/partial-blame-line.type.js';

const HEADER_REGEX = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/;

export async function* parseBlamePorcelain(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<BlameLine> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let state: PartialBlameLine | null = null;

  for await (const raw of rl) {
    if (raw.startsWith('\t')) {
      yield finaliseContentLine(state, raw);
      state = null;
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(raw);
    if (headerMatch !== null) {
      state = beginNewEntry(state, headerMatch[1] ?? '');
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
