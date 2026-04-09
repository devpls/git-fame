import { cpus } from 'node:os';
import pLimit from 'p-limit';
import { spawnGit } from '../git/spawn-git.js';
import { parseBlamePorcelain } from '../parse/parse-blame-porcelain/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

export interface BlameOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const blameOneFile = async (
  cwd: string,
  file: string,
  aggregator: Aggregator,
  options: BlameOptions,
): Promise<void> => {
  try {
    const args = ['blame', '--line-porcelain', options.rev];
    if (options.followRenames) {
      args.push('-M', '-C');
    }
    if (options.ignoreWhitespace) {
      args.push('-w');
    }
    args.push('--', file);
    const result = spawnGit(args, cwd);
    const consume = async (): Promise<void> => {
      for await (const line of parseBlamePorcelain(result.stdout)) {
        aggregator.recordBlameLine(line);
      }
    };
    await Promise.all([consume(), result.done]);
  } catch (err) {
    aggregator.recordWarning({
      code: 'BLAME_FAILED',
      file,
      error: err instanceof Error ? err.message : String(err),
      message: `git blame failed for ${file}`,
    });
  }
};

export const runBlamePhase = async (
  cwd: string,
  files: readonly string[],
  aggregator: Aggregator,
  options: BlameOptions,
): Promise<void> => {
  if (files.length === 0) {
    return;
  }
  const limit = pLimit(Math.max(1, cpus().length));
  await Promise.all(files.map((file) => limit(() => blameOneFile(cwd, file, aggregator, options))));
};
