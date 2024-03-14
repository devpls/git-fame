import { exec } from 'node:child_process';

export const blameFile = (dir: string, file: string) => {
  return new Promise<string[]>((resolve, reject) => {
    exec(
      `git blame --no-merges ${file}`,
      { cwd: dir, maxBuffer: 1024 * 1024 * 10 },
      (err, stdout) => {
        if (err) {
          reject(err);
        }
        resolve(stdout.split(/\r?\n|\r|\n/g));
      },
    );
  });
};
