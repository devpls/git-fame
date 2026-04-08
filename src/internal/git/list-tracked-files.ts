import { collectStream } from './collect-stream.js';
import { spawnGit } from './spawn-git.js';

export const listTrackedFiles = async (cwd: string, signal?: AbortSignal): Promise<string[]> => {
  const result = spawnGit(['ls-files', '-z'], cwd, signal);
  const [text] = await Promise.all([collectStream(result.stdout), result.done]);
  if (text.length === 0) {
    return [];
  }
  return text.split('\0').filter((p) => p.length > 0);
};
