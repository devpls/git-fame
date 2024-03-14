import fs from 'fs';
import * as path from 'path';

export const isGitRepo = (dir: string) => {
  return fs.existsSync(path.join(dir, '.git'));
};
