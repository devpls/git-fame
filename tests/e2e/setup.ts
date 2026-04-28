import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const setup = (): void => {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) {
    throw new Error(`build failed:\n${build.stderr}`);
  }
};
