import fs from 'fs';
import path from 'path';

export const getSubdirectories = (dir: string) => {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => path.join(dir, dirent.name));
};
