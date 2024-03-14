import { exec } from 'node:child_process';
import { logger } from '@/utils';
import * as process from 'process';

export const gitValidator = (path: string) => {
  // Check if git installed in the system
  exec('git --version', (error) => {
    if (error) {
      logger.error('Git is not installed in the system');
      process.exit();
    }
  });
  return path;
};
