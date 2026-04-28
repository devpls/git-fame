import type { BreakdownEntry } from './breakdown-entry.type.js';
import type { RepoWarning } from './repo-warning.type.js';
import type { SummaryAuthor } from './summary-author.type.js';

export interface Summary {
  meta: {
    version: string;
    generatedAt: Date;
    repoCount: number;
  };
  repos: {
    path: string;
    headSha: string;
    headRef: string;
  }[];
  totals: {
    linesAlive: number;
    linesAdded: number;
    linesDeleted: number;
    commits: number;
    files: number;
  };
  authors: SummaryAuthor[];
  warnings: RepoWarning[];
  breakdown?: BreakdownEntry[];
}
