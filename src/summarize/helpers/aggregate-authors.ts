import type { Report } from '../../types/report.type.js';
import type { SummaryAuthor } from '../../types/summary-author.type.js';
import { finaliseAuthor, type MutableSummaryAuthor } from './finalise-author.js';
import { mergeAuthorBreakdown } from './merge-author-breakdown.js';

export const aggregateAuthors = (reports: Report[]): SummaryAuthor[] => {
  const byEmail = new Map<string, MutableSummaryAuthor>();

  for (const report of reports) {
    for (const author of report.authors) {
      const key = author.email.toLowerCase();
      const existing = byEmail.get(key);

      const perRepoEntry = {
        path: report.repo.path,
        linesAlive: author.linesAlive,
        linesAdded: author.linesAdded,
        linesDeleted: author.linesDeleted,
        commits: author.commits,
        files: author.files,
        ...(author.breakdown !== undefined ? { breakdown: author.breakdown } : {}),
      };

      if (existing === undefined) {
        byEmail.set(key, {
          name: author.name,
          email: author.email,
          linesAlive: author.linesAlive,
          linesAdded: author.linesAdded,
          linesDeleted: author.linesDeleted,
          commits: author.commits,
          files: author.files,
          firstCommit: author.firstCommit,
          lastCommit: author.lastCommit,
          breakdown: author.breakdown !== undefined ? { ...author.breakdown } : undefined,
          perRepo: [perRepoEntry],
        });
        continue;
      }

      existing.linesAlive += author.linesAlive;
      existing.linesAdded += author.linesAdded;
      existing.linesDeleted += author.linesDeleted;
      existing.commits += author.commits;
      existing.files += author.files;

      if (author.lastCommit > existing.lastCommit) {
        existing.lastCommit = author.lastCommit;
        existing.name = author.name;
      }

      if (author.firstCommit < existing.firstCommit) {
        existing.firstCommit = author.firstCommit;
      }

      if (author.breakdown !== undefined) {
        existing.breakdown = mergeAuthorBreakdown(existing.breakdown, author.breakdown);
      }

      existing.perRepo.push(perRepoEntry);
    }
  }

  return Array.from(byEmail.values()).map(finaliseAuthor);
};
