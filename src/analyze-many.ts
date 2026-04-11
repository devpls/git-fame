import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from './analyze.js';
import { discoverSubmodules } from './internal/git/discover-submodules.js';
import { isGitRepo } from './internal/git/is-git-repo.js';
import type { AnalyzeManyOptions } from './types/analyze-many-options.type.js';
import type { Report } from './types/report.type.js';

const toAnalyzeOptions = (options: AnalyzeManyOptions) => {
  const { splitSubmodules: _s, recursive: _r, ...analyzeOptions } = options;
  return analyzeOptions;
};

export const analyzeMany = async (options: AnalyzeManyOptions): Promise<Report[]> => {
  if (options.splitSubmodules === true) {
    const base = toAnalyzeOptions(options);
    const parentReport = await analyze({ ...base, submodules: false });
    const submodules = discoverSubmodules(options.path);
    const subReports: Report[] = [];
    for (const sub of submodules) {
      if (!sub.initialized) {
        continue;
      }
      const subReport = await analyze({
        ...base,
        path: join(options.path, sub.path),
        submodules: false,
      });
      subReports.push(subReport);
    }
    return [parentReport, ...subReports];
  }

  if (options.recursive === true) {
    const base = toAnalyzeOptions(options);
    const reports: Report[] = [];
    if (isGitRepo(options.path)) {
      reports.push(await analyze(base));
    }
    const entries = readdirSync(options.path, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const subDir = join(options.path, entry.name);
      if (!isGitRepo(subDir)) {
        continue;
      }
      reports.push(await analyze({ ...base, path: subDir }));
    }
    return reports;
  }

  return [await analyze(toAnalyzeOptions(options))];
};
