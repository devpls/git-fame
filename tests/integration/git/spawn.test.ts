import { describe, expect, it } from 'vitest';
import { spawnGit } from '../../../src/internal/git/spawn.js';

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('spawnGit', () => {
  it('runs git --version and streams stdout', async () => {
    const result = spawnGit(['--version'], process.cwd());
    const [output] = await Promise.all([collect(result.stdout), result.done]);
    expect(output).toMatch(/^git version /);
  });

  it('rejects done with GitCommandError on non-zero exit', async () => {
    const { GitCommandError } = await import('../../../src/errors.js');
    const result = spawnGit(['not-a-real-git-command'], process.cwd());
    // Drain stdout to avoid a stuck pipe
    result.stdout.resume();
    await expect(result.done).rejects.toBeInstanceOf(GitCommandError);
  });

  it('GitCommandError carries cmd, cwd, stderr, and exit code', async () => {
    const { GitCommandError } = await import('../../../src/errors.js');
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
});
