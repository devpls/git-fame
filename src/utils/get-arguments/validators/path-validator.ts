import fs from 'fs';
import { logger } from '@/utils';

export const pathValidator = (path: string) => {
  console.log('path', path);
  if (!fs.existsSync(path)) {
    logger.error('Path does not exist. Please provide a valid path.');
    process.exit();
  }
  return path;
};
