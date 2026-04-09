import { describe, expect, it } from 'vitest';
import { AbortError } from '../../errors/abort.error.js';
import { GitCommandError } from '../../errors/git-command.error.js';
import { collectStream } from './collect-stream.js';
import { spawnGit } from './spawn-git.js';

describe('spawnGit', () => {
  it('runs git --version and streams stdout', async () => {
    const result = spawnGit(['--version'], process.cwd());
    const [output] = await Promise.all([collectStream(result.stdout), result.done]);
    expect(output).toMatch(/^git version /);
  });

  it('rejects done with GitCommandError on non-zero exit', async () => {
    const result = spawnGit(['not-a-real-git-command'], process.cwd());
    result.stdout.resume();
    await expect(result.done).rejects.toBeInstanceOf(GitCommandError);
  });

  it('GitCommandError carries cmd, cwd, stderr, and exit code', async () => {
    const result = spawnGit(['not-a-real-git-command'], process.cwd());
    result.stdout.resume();
    try {
      await result.done;
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(GitCommandError);
      const typed = err as InstanceType<typeof GitCommandError>;
      expect(typed.cmd).toBe('git not-a-real-git-command');
      expect(typed.cwd).toBe(process.cwd());
      expect(typed.exitCode).toBeGreaterThan(0);
      expect(typed.stderr.length).toBeGreaterThan(0);
    }
  });

  it('throws AbortError immediately when signal is already aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => spawnGit(['--version'], process.cwd(), controller.signal)).toThrow(AbortError);
  });

  it('rejects done with AbortError when signal aborts mid-execution', async () => {
    const controller = new AbortController();
    // git hash-object --stdin blocks indefinitely on stdin — guaranteed alive when abort fires
    const result = spawnGit(['hash-object', '--stdin'], process.cwd(), controller.signal);
    result.stdout.resume();
    queueMicrotask(() => {
      controller.abort();
    });
    await expect(result.done).rejects.toBeInstanceOf(AbortError);
  });

  it('accepts no signal (backwards-compatible two-arg call shape)', async () => {
    const result = spawnGit(['--version'], process.cwd());
    result.stdout.resume();
    await expect(result.done).resolves.toBeUndefined();
  });
});
