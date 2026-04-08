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
});
