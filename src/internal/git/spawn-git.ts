import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { AbortError } from '../../errors/abort.error.js';
import { GitCommandError } from '../../errors/git-command.error.js';

export interface SpawnGitResult {
  stdout: Readable;
  done: Promise<void>;
}

const GIT_ENV_OVERRIDES = {
  LC_ALL: 'C',
  GIT_OPTIONAL_LOCKS: '0',
};

const SIGKILL_GRACE_MS = 500;

export const spawnGit = (
  args: readonly string[],
  cwd: string,
  signal?: AbortSignal,
): SpawnGitResult => {
  if (signal?.aborted === true) {
    throw new AbortError();
  }

  const child: ChildProcess = spawn('git', [...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV_OVERRIDES },
  });

  if (child.stdout === null) {
    throw new Error('spawnGit: stdout pipe is null');
  }
  const stdout = child.stdout;

  const stderrChunks: Buffer[] = [];
  if (child.stderr !== null) {
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
  }

  const done = new Promise<void>((resolve, reject) => {
    let aborted = false;
    let killTimer: NodeJS.Timeout | undefined;

    const onAbort = (): void => {
      aborted = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_MS);
      killTimer.unref();
    };

    if (signal !== undefined) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = (): void => {
      if (signal !== undefined) {
        signal.removeEventListener('abort', onAbort);
      }
      if (killTimer !== undefined) {
        clearTimeout(killTimer);
      }
    };

    child.on('error', (err) => {
      cleanup();
      reject(err);
    });

    child.on('close', (code) => {
      cleanup();
      if (aborted) {
        reject(new AbortError());
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      reject(new GitCommandError(`git ${args.join(' ')}`, cwd, stderr, code ?? -1));
    });
  });

  return { stdout, done };
};
