import { spawnGit } from './spawn.js';

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function listTrackedFiles(cwd: string, signal?: AbortSignal): Promise<string[]> {
  const result = spawnGit(['ls-files', '-z'], cwd, signal);
  const [text] = await Promise.all([collect(result.stdout), result.done]);
  if (text.length === 0) {
    return [];
  }
  return text.split('\0').filter((p) => p.length > 0);
}
