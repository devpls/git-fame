import type { Report } from '../types/report.type.js';
import type { Summary } from '../types/summary.type.js';
import { version } from '../version.js';
import { aggregateAuthors } from './helpers/aggregate-authors.js';
import { aggregateBreakdown } from './helpers/aggregate-breakdown.js';
import { aggregateWarnings } from './helpers/aggregate-warnings.js';

export const summarize = (reports: Report[]): Summary => {
  const first = reports[0];
  if (first === undefined) {
    throw new Error('summarize requires at least one report');
  }

  let generatedAt = first.meta.generatedAt;
  let linesAlive = 0;
  let commits = 0;
  let files = 0;

  for (const report of reports) {
    if (report.meta.generatedAt > generatedAt) {
      generatedAt = report.meta.generatedAt;
    }
    linesAlive += report.repo.totals.lines;
    commits += report.repo.totals.commits;
    files += report.repo.totals.files;
  }

  const authors = aggregateAuthors(reports);

  let linesAdded = 0;
  let linesDeleted = 0;
  for (const report of reports) {
    for (const author of report.authors) {
      linesAdded += author.linesAdded;
      linesDeleted += author.linesDeleted;
    }
  }

  const breakdown = aggregateBreakdown(reports);

  return {
    meta: {
      version,
      generatedAt,
      repoCount: reports.length,
    },
    repos: reports.map((r) => ({
      path: r.repo.path,
      headSha: r.repo.headSha,
      headRef: r.repo.headRef,
    })),
    totals: { linesAlive, linesAdded, linesDeleted, commits, files },
    authors,
    warnings: aggregateWarnings(reports),
    ...(breakdown !== undefined ? { breakdown } : {}),
  };
};
