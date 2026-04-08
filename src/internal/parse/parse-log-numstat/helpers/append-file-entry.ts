import type { LogCommit } from '../types/log-commit.type.js';
import { parseCount } from './parse-count.js';

export const appendFileEntry = (current: LogCommit | null, match: RegExpExecArray): void => {
  if (current === null) {
    throw new Error('parseLogNumstat: file entry before any commit header');
  }
  current.files.push({
    path: match[3] ?? '',
    added: parseCount(match[1] ?? '0'),
    deleted: parseCount(match[2] ?? '0'),
  });
};
