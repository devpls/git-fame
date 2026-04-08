import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnGit } from './spawn.js';
import { GitCommandError, InvalidRevError, NotAGitRepoError } from '../../errors.js';

export function isGitRepo(path: string): boolean {
  const gitPath = join(path, '.git');
  if (!existsSync(gitPath)) {
    return false;
  }
  const stat = statSync(gitPath);
  // .git is a directory in normal repos and a file (gitlink) in submodules.
  return stat.isDirectory() || stat.isFile();
}

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function resolveRev(cwd: string, rev: string): Promise<string> {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  try {
    const result = spawnGit(['rev-parse', '--verify', `${rev}^{commit}`], cwd);
    const [text] = await Promise.all([collect(result.stdout), result.done]);
    return text.trim();
  } catch (err) {
    if (err instanceof GitCommandError) {
      throw new InvalidRevError(rev, cwd);
    }
    throw err;
  }
}

export interface Range {
  from: string;
  to: string;
}

export interface ResolvedRange {
  fromSha: string;
  toSha: string;
}

export async function resolveRange(cwd: string, range: Range): Promise<ResolvedRange> {
  const [fromSha, toSha] = await Promise.all([
    resolveRev(cwd, range.from),
    resolveRev(cwd, range.to),
  ]);
  return { fromSha, toSha };
}
