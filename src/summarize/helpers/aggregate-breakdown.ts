import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';
import type { Report } from '../../types/report.type.js';

export const aggregateBreakdown = (reports: Report[]): BreakdownEntry[] | undefined => {
  const byGroup = new Map<string, { linesAlive: number; files: number }>();

  for (const report of reports) {
    if (report.breakdown === undefined) {
      continue;
    }
    for (const entry of report.breakdown) {
      const existing = byGroup.get(entry.group);
      if (existing !== undefined) {
        existing.linesAlive += entry.linesAlive;
        existing.files += entry.files;
      } else {
        byGroup.set(entry.group, { linesAlive: entry.linesAlive, files: entry.files });
      }
    }
  }

  if (byGroup.size === 0) {
    return undefined;
  }

  return Array.from(byGroup.entries()).map(([group, data]) => ({
    group,
    linesAlive: data.linesAlive,
    files: data.files,
  }));
};
