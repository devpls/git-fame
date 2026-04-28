import type { Report } from '../../types/report.type.js';
import type { RepoWarning } from '../../types/repo-warning.type.js';

export const aggregateWarnings = (reports: Report[]): RepoWarning[] => {
  const warnings: RepoWarning[] = [];
  for (const report of reports) {
    for (const warning of report.warnings) {
      warnings.push({ repo: report.repo.path, warning });
    }
  }
  return warnings;
};
