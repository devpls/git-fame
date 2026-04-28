import { existsSync, statSync } from 'node:fs';

export type OutputMode = 'stdout' | 'file' | 'directory';

export const detectOutputMode = (outputPath: string | undefined): OutputMode => {
  if (outputPath === undefined) {
    return 'stdout';
  }

  if (outputPath.endsWith('/') || outputPath.endsWith('\\')) {
    return 'directory';
  }

  if (existsSync(outputPath) && statSync(outputPath).isDirectory()) {
    return 'directory';
  }

  return 'file';
};
