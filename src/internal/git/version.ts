import { spawnGit } from './spawn.js';
import { GitNotInstalledError } from '../../errors.js';

const MIN_GIT_MAJOR = 2;
const MIN_GIT_MINOR = 30;

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function assertGitInstalled(): Promise<void> {
  let output: string;
  try {
    const result = spawnGit(['--version'], process.cwd());
    const [text] = await Promise.all([collect(result.stdout), result.done]);
    output = text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GitNotInstalledError(`failed to run git --version: ${message}`);
  }

  const versionMatch = /git version (\d+)\.(\d+)/.exec(output);
  if (versionMatch === null) {
    throw new GitNotInstalledError(`could not parse git version from output: ${output.trim()}`);
  }

  const majorStr = versionMatch[1] ?? '0';
  const minorStr = versionMatch[2] ?? '0';
  const major = Number(majorStr);
  const minor = Number(minorStr);

  if (major < MIN_GIT_MAJOR || (major === MIN_GIT_MAJOR && minor < MIN_GIT_MINOR)) {
    throw new GitNotInstalledError(
      `git ${String(major)}.${String(minor)} is too old; need ${String(MIN_GIT_MAJOR)}.${String(MIN_GIT_MINOR)}+`,
    );
  }
}
