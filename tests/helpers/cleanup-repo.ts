import { rmSync } from 'node:fs';

export const cleanupRepo = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};
