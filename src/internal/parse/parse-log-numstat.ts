import { createInterface } from 'node:readline';

export interface LogFileChange {
  path: string;
  added: number;
  deleted: number;
}

export interface LogCommit {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  files: LogFileChange[];
}

const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

const parseCount = (value: string): number => (value === '-' ? 0 : Number(value));

const parseCommitHeader = (raw: string): LogCommit => {
  const parts = raw.split('\x00');
  if (parts.length !== 4) {
    throw new Error(
      `parseLogNumstat: expected 4 NUL-separated header fields, got ${String(parts.length)}`,
    );
  }
  return {
    sha: parts[0] ?? '',
    authorName: parts[1] ?? '',
    authorMail: parts[2] ?? '',
    authorTime: Number(parts[3] ?? '0'),
    files: [],
  };
};

const appendFileEntry = (current: LogCommit | null, match: RegExpExecArray): void => {
  if (current === null) {
    throw new Error('parseLogNumstat: file entry before any commit header');
  }
  current.files.push({
    path: match[3] ?? '',
    added: parseCount(match[1] ?? '0'),
    deleted: parseCount(match[2] ?? '0'),
  });
};

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
