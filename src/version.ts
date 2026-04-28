import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const findVersion = (): string => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const raw = readFileSync(resolve(dir, 'package.json'), 'utf8');
      return (JSON.parse(raw) as { version: string }).version;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error('Could not find package.json');
      dir = parent;
    }
  }
};

export const version: string = findVersion();
