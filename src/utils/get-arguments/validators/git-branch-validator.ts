import { exec } from 'node:child_process';
import { logger } from '@/utils';

export const gitBranchValidator = (value: string) => {
  exec(`git checkout --dry-run ${value}`, (error) => {
    if (error) {
      logger.error('Invalid branch name or branch does not exist');
      process.exit();
    }
  });
  return value;
};
