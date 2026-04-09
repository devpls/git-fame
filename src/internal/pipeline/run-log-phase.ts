import { collectStream } from '../git/collect-stream.js';
import { spawnGit } from '../git/spawn-git.js';
import { parseLogNumstat } from '../parse/parse-log-numstat/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

export interface LogPhaseOptions {
  range?: { fromSha: string; toSha: string };
  since?: Date;
  until?: Date;
}

const LOG_BASE_ARGS = [
  'log',
  '--no-merges',
  '--pretty=format:%H%x00%an%x00%ae%x00%at',
  '--numstat',
] as const;

export const runLogPhase = async (
  cwd: string,
  aggregator: Aggregator,
  options?: LogPhaseOptions,
): Promise<void> => {
  const args: string[] = [...LOG_BASE_ARGS];

  if (options?.since !== undefined) {
    args.push(`--since=${options.since.toISOString()}`);
  }
  if (options?.until !== undefined) {
    args.push(`--until=${options.until.toISOString()}`);
  }
  if (options?.range !== undefined) {
    args.push(`${options.range.fromSha}..${options.range.toSha}`);
  }

  const result = spawnGit(args, cwd);

  try {
    const [output] = await Promise.all([collectStream(result.stdout), result.done]);
    const commits = parseLogNumstat(output);
    for (const commit of commits) {
      aggregator.recordCommit(commit);
    }
  } catch (err) {
    // Empty repo causes git log to exit non-zero ("does not have any commits yet").
    // That is a legitimate empty state; the aggregator simply has no data.
    if (err instanceof Error && /does not have any commits|unknown revision/i.test(err.message)) {
      return;
    }
    throw err;
  }
};
