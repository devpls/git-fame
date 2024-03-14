import git from 'simple-git';
import Table from 'cli-table3';
import { performance } from 'perf_hooks';
import ora from 'ora';
import cliProgress from 'cli-progress';

import {
  collectGitPaths,
  getFilteredFiles,
  getArguments,
  getLsFiles,
  logger,
  blameFile,
} from '@/utils';
import { Stats } from '@/types';

const getProgressBar = () => {
  return new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
};

// const collectPaths = async () => {};
//
// const main = async () => {
//     const spinner = ora('Starting analysis...').start();
//
//     const filteredFiles = filesArr.filter(file => !repoFilter || repoFilter.test(file));
//
//     const startTime = performance.now();
//     let processedFiles = 0; // Atomic counter for processed files
//
//     // Process files in parallel
//     const blamePromises = filteredFiles.map(file => {
//         return gitP.raw(['blame', '--no-merges', file]).then(blame => {
//             const lines = blame.split('\n');
//             for (const line of lines) {
//                 const regex = /^(\w+)\s+(.*?)\((.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\s+(\d+)\)\s+(.*)$/;
//                 const match = line.match(regex);
//                 if (match) {
//                     const author = match[3];
//                     if (authorLines[author]) {
//                         authorLines[author] += 1;
//                     } else {
//                         authorLines[author] = 1;
//                     }
//                 }
//             }
//             processedFiles++; // Increment the counter
//             spinner.text = `Analyzing (${processedFiles}/${filteredFiles.length})`; // Update the spinner text with progress
//         });
//     });
//
//     await Promise.all(blamePromises);
//
//     const endTime = performance.now();
//     const parseTime = (endTime - startTime) / 1000;
//     const filesPerSecond = filteredFiles.length / parseTime;
//
//     spinner.succeed(`Analysis complete`);
//     console.log(`Parsed ${filteredFiles.length} files in ${parseTime.toFixed(2)} seconds (${filesPerSecond.toFixed(2)} files/second)`);
//
//     const sortedLines = Object.entries(authorLines).sort((a, b) => b[1] - a[1]);
//     for (const [author, lines] of sortedLines) {
//         table.push([author, lines]);
//     }
//     console.log(table.toString());
// }

// main();

const collectStats = async (filesMap: Record<string, string[]>): Promise<Stats> => {
  return await Object.keys(filesMap).reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      const files = filesMap[dir];

      for (const file of files) {
        const lines = await blameFile(dir, file);
        for (const line of lines) {
          const regex =
            /^(\w+)\s+(.*?)\((.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\s+(\d+)\)\s+(.*)$/;
          const match = line.match(regex);
          if (match) {
            console.log(match);
            const author = match[3];
          }
        }
      }

      return acc;
    },
    Promise.resolve({} as Stats),
  );
};

const collectLsFiles = async (
  dirs: string[],
  filter: string,
): Promise<Record<string, string[]>> => {
  const spinner = ora('Collecting files...').start();
  const filesArr: Record<string, string[]> = {};

  await Promise.all(
    dirs.map(async (dir) => {
      const files = await getLsFiles(dir);
      const filteredFiles = getFilteredFiles([...new Set(files)], filter);
      if (filteredFiles.length > 0) {
        filesArr[dir] = filteredFiles;
      }
    }),
  );

  spinner.succeed('Files collected');
  return filesArr;
};
(async () => {
  const { path, filter } = getArguments();
  const paths = await collectGitPaths(path);
  const filesMap = await collectLsFiles(paths, filter);
  const stats = collectStats(filesMap);
})();
