import { spawn } from 'node:child_process';
import { computeGroupKey } from './compute-group-key.js';
import { countBlameLines } from './count-blame-lines.js';
import type { Aggregator } from '../identity/aggregator/index.js';

const SEPARATOR = '__BLAME_END__';

interface BlameWorkerOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const buildBlameCommand = (
  rev: string,
  followRenames: boolean,
  ignoreWhitespace: boolean,
): string => {
  const parts = ['git blame --porcelain', rev];
  if (followRenames) {
    parts.push('-M -C');
  }
  if (ignoreWhitespace) {
    parts.push('-w');
  }
  return parts.join(' ');
};

export interface BlameWorker {
  blame(file: string): Promise<void>;
  close(): void;
}

export const createBlameWorker = (
  cwd: string,
  aggregator: Aggregator,
  options: BlameWorkerOptions,
  groupBy?: { type: 'extension' | 'directory'; depth: number },
): BlameWorker => {
  const blameCmd = buildBlameCommand(options.rev, options.followRenames, options.ignoreWhitespace);

  const child = spawn(
    'sh',
    [
      '-c',
      `while IFS= read -r file; do ${blameCmd} -- "$file" 2>/dev/null; echo "${SEPARATOR}"; done`,
    ],
    { cwd, stdio: ['pipe', 'pipe', 'ignore'] },
  );

  let buffer = '';
  let currentFile = '';
  let resolver: (() => void) | null = null;

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf(SEPARATOR + '\n')) !== -1) {
      const blameOutput = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + SEPARATOR.length + 1);

      if (blameOutput.length === 0) {
        aggregator.recordWarning({
          code: 'BLAME_FAILED',
          file: currentFile,
          error: 'empty output',
          message: `git blame produced no output for ${currentFile}`,
        });
      } else {
        try {
          const gk = groupBy !== undefined ? computeGroupKey(currentFile, groupBy) : undefined;
          countBlameLines(blameOutput, aggregator, gk);
          if (gk !== undefined) {
            aggregator.recordFileGroup(gk, currentFile);
          }
        } catch {
          aggregator.recordWarning({
            code: 'BLAME_FAILED',
            file: currentFile,
            error: 'parse error',
            message: `Failed to parse blame output for ${currentFile}`,
          });
        }
      }

      if (resolver !== null) {
        const r = resolver;
        resolver = null;
        r();
      }
    }
  });

  child.on('error', (err) => {
    if (resolver !== null) {
      resolver();
      resolver = null;
    }
    aggregator.recordWarning({
      code: 'BLAME_FAILED',
      file: currentFile,
      error: err.message,
      message: `Blame worker error: ${err.message}`,
    });
  });

  child.on('close', () => {
    if (resolver !== null) {
      resolver();
      resolver = null;
    }
  });

  return {
    blame(file: string): Promise<void> {
      return new Promise((resolve) => {
        currentFile = file;
        resolver = resolve;
        child.stdin.write(file + '\n');
      });
    },
    close(): void {
      child.stdin.end();
    },
  };
};
