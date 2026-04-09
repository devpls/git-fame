import { appendFileEntry } from './helpers/append-file-entry.js';
import { parseCommitHeader } from './helpers/parse-commit-header.js';
import type { LogCommit } from './types/log-commit.type.js';

const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export const parseLogNumstat = (output: string): LogCommit[] => {
  const results: LogCommit[] = [];
  let current: LogCommit | null = null;

  for (const raw of output.split('\n')) {
    if (raw.length === 0) {
      continue;
    }

    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (line.length === 0) {
      continue;
    }

    if (line.includes('\x00')) {
      if (current !== null) {
        results.push(current);
      }
      current = parseCommitHeader(line);
      continue;
    }

    const numstatMatch = NUMSTAT_REGEX.exec(line);
    if (numstatMatch !== null) {
      appendFileEntry(current, numstatMatch);
      continue;
    }

    throw new Error(`parseLogNumstat: unrecognised line: ${line}`);
  }

  if (current !== null) {
    results.push(current);
  }

  return results;
};
