import { exec } from 'node:child_process';
import * as console from 'console';

export const getLsFiles = (dir: string) => {
  return new Promise<string[]>((resolve, reject) => {
    exec(`git ls-files`, { cwd: dir, maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
      // Increase maxBuffer size to 10MB
      if (err) {
        reject(err);
      }
      resolve(stdout.split(/\r?\n|\r|\n/g));
    });
  });
};
