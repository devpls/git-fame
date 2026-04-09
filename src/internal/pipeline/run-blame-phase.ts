import { cpus } from 'node:os';
import { createBlameWorker } from './blame-worker.js';
import type { BlameWorker } from './blame-worker.js';
import type { Aggregator } from '../identity/aggregator/index.js';
import type { ProgressEvent } from '../../types/progress-event.type.js';

export interface BlameOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const resolveWorkerCount = (concurrency: number | undefined, fileCount: number): number => {
  const cpuBased = Math.min(cpus().length * 3, 32);
  const requested = concurrency ?? cpuBased;
  return Math.min(requested, fileCount);
};

export const runBlamePhase = async (
  cwd: string,
  files: readonly string[],
  aggregator: Aggregator,
  options: BlameOptions,
  onProgress?: (event: ProgressEvent) => void,
  concurrency?: number,
  groupBy?: { type: 'extension' | 'directory'; depth: number },
): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const workerCount = resolveWorkerCount(concurrency, files.length);
  const workers = Array.from({ length: workerCount }, () =>
    createBlameWorker(cwd, aggregator, options, groupBy),
  );

  let nextIdx = 0;
  let completed = 0;

  const runWorker = async (worker: BlameWorker): Promise<void> => {
    while (nextIdx < files.length) {
      const idx = nextIdx;
      nextIdx += 1;
      const file = files[idx];
      if (file === undefined) {
        break;
      }
      await worker.blame(file);
      completed += 1;
      onProgress?.({ type: 'blame', file, done: completed, total: files.length });
    }
    worker.close();
  };

  await Promise.all(workers.map(runWorker));
};
