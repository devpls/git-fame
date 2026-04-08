import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';

export interface SpawnGitResult {
  stdout: Readable;
  done: Promise<void>;
}

const GIT_ENV_OVERRIDES = {
  LC_ALL: 'C',
  GIT_OPTIONAL_LOCKS: '0',
};

export function spawnGit(args: readonly string[], cwd: string): SpawnGitResult {
  const child: ChildProcess = spawn('git', [...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV_OVERRIDES },
  });

  if (child.stdout === null) {
    throw new Error('spawnGit: stdout pipe is null');
  }
  const stdout = child.stdout;

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(' ')} exited with code ${String(code)}`));
      }
    });
  });

  return { stdout, done };
}
