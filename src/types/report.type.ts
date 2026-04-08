import type { AuthorStats } from './author-stats.type.js';
import type { Warning } from './warning.type.js';

export interface Report {
  meta: {
    version: string;
    generatedAt: Date;
    durationMs: number;
  };
  repo: {
    path: string;
    headSha: string;
    headRef: string;
    range?: {
      fromSha: string;
      toSha: string;
      fromRef: string;
      toRef: string;
    };
    totals: {
      lines: number;
      commits: number;
      files: number;
    };
  };
  authors: AuthorStats[];
  warnings: Warning[];
}
