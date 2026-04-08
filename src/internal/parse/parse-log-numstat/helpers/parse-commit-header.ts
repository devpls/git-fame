import type { LogCommit } from '../types/log-commit.type.js';

export const parseCommitHeader = (raw: string): LogCommit => {
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
