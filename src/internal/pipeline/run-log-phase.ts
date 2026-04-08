import { spawnGit } from '../git/spawn-git.js';
import { parseLogNumstat } from '../parse/parse-log-numstat/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

const LOG_ARGS = [
  'log',
  '--no-merges',
  '--pretty=format:%H%x00%an%x00%ae%x00%at',
  '--numstat',
] as const;

export const runLogPhase = async (cwd: string, aggregator: Aggregator): Promise<void> => {
  const result = spawnGit([...LOG_ARGS], cwd);

  const consume = async (): Promise<void> => {
    for await (const commit of parseLogNumstat(result.stdout)) {
      aggregator.recordCommit(commit);
    }
  };

  try {
    await Promise.all([consume(), result.done]);
  } catch (err) {
    // Empty repo causes git log to exit non-zero ("does not have any commits yet").
    // That is a legitimate empty state; the aggregator simply has no data.
    if (err instanceof Error && /does not have any commits|unknown revision/i.test(err.message)) {
      return;
    }
    throw err;
  }
};
