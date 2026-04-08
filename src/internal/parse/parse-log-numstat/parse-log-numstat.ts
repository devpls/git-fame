import { createInterface } from 'node:readline';
import { appendFileEntry } from './helpers/append-file-entry.js';
import { parseCommitHeader } from './helpers/parse-commit-header.js';
import type { LogCommit } from './types/log-commit.type.js';

const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export async function* parseLogNumstat(stream: NodeJS.ReadableStream): AsyncGenerator<LogCommit> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let current: LogCommit | null = null;

  for await (const raw of rl) {
    if (raw.length === 0) {
      continue;
    }

    if (raw.includes('\x00')) {
      if (current !== null) {
        yield current;
      }
      current = parseCommitHeader(raw);
      continue;
    }

    const numstatMatch = NUMSTAT_REGEX.exec(raw);
    if (numstatMatch !== null) {
      appendFileEntry(current, numstatMatch);
      continue;
    }

    throw new Error(`parseLogNumstat: unrecognised line: ${raw}`);
  }

  if (current !== null) {
    yield current;
  }
}
