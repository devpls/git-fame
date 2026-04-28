import type { SummaryAuthor } from '../../types/summary-author.type.js';

interface MutableSummaryAuthor {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  files: number;
  firstCommit: Date;
  lastCommit: Date;
  breakdown: Record<string, number> | undefined;
  perRepo: SummaryAuthor['perRepo'];
}

export type { MutableSummaryAuthor };

export const finaliseAuthor = (mutable: MutableSummaryAuthor): SummaryAuthor => ({
  name: mutable.name,
  email: mutable.email,
  linesAlive: mutable.linesAlive,
  linesAdded: mutable.linesAdded,
  linesDeleted: mutable.linesDeleted,
  commits: mutable.commits,
  files: mutable.files,
  firstCommit: mutable.firstCommit,
  lastCommit: mutable.lastCommit,
  ...(mutable.breakdown !== undefined ? { breakdown: mutable.breakdown } : {}),
  perRepo: mutable.perRepo,
});
