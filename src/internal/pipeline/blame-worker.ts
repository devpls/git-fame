import { spawn } from 'node:child_process';
import { computeGroupKey } from './compute-group-key.js';
import { countBlameLines } from './count-blame-lines.js';
import type { Aggregator } from '../identity/aggregator/index.js';

interface BlameWorkerOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const buildBlameArgs = (
  rev: string,
  followRenames: boolean,
  ignoreWhitespace: boolean,
  file: string,
): string[] => {
  const args = ['blame', '--porcelain', rev];
  if (followRenames) {
    args.push('-M', '-C');
  }
  if (ignoreWhitespace) {
    args.push('-w');
  }
  args.push('--', file);
  return args;
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
  return {
    blame(file: string): Promise<void> {
      return new Promise((resolve) => {
        const args = buildBlameArgs(
          options.rev,
          options.followRenames,
          options.ignoreWhitespace,
          file,
        );
        const child = spawn('git', args, {
          cwd,
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        const chunks: Buffer[] = [];
        let settled = false;

        child.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        child.on('error', (err) => {
          if (settled) {
            return;
          }
          settled = true;
          aggregator.recordWarning({
            code: 'BLAME_FAILED',
            file,
            error: err.message,
            message: `Blame worker error: ${err.message}`,
          });
          resolve();
        });

        child.on('close', () => {
          if (settled) {
            return;
          }
          settled = true;
          const output = Buffer.concat(chunks).toString('utf8');
          if (output.length === 0) {
            aggregator.recordWarning({
              code: 'BLAME_FAILED',
              file,
              error: 'empty output',
              message: `git blame produced no output for ${file}`,
            });
            resolve();
            return;
          }
          try {
            const gk = groupBy !== undefined ? computeGroupKey(file, groupBy) : undefined;
            countBlameLines(output, aggregator, gk);
            if (gk !== undefined) {
              aggregator.recordFileGroup(gk, file);
            }
          } catch {
            aggregator.recordWarning({
              code: 'BLAME_FAILED',
              file,
              error: 'parse error',
              message: `Failed to parse blame output for ${file}`,
            });
          }
          resolve();
        });
      });
    },
    close(): void {
      // Nothing to clean up — each blame spawns its own short-lived git process.
    },
  };
};
