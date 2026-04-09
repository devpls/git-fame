import type { AuthorStats } from '../../types/author-stats.type.js';
import type { Report } from '../../types/report.type.js';
import type { RenderOptions, SortableColumn } from '../types/render-options.type.js';

export interface PreparedAuthor {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  linesNet: number;
  commits: number;
  files: number;
  percentAlive: string;
}

const formatPercent = (value: number, total: number): string => {
  if (total === 0) return '0.0';
  return ((value / total) * 100).toFixed(1);
};

const getSortValue = (author: AuthorStats, by: SortableColumn): number => {
  if (by === 'lastCommit') return author.lastCommit.getTime();
  return author[by];
};

export const prepareAuthors = (report: Report, options?: RenderOptions): PreparedAuthor[] => {
  const sortBy = options?.sort?.by ?? 'linesAlive';
  const sortOrder = options?.sort?.order ?? 'desc';
  const totalAlive = report.authors.reduce((sum, a) => sum + a.linesAlive, 0);

  const sorted = [...report.authors].sort((a, b) => {
    const aVal = getSortValue(a, sortBy);
    const bVal = getSortValue(b, sortBy);
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const limited = options?.limit !== undefined ? sorted.slice(0, options.limit) : sorted;

  return limited.map((author) => ({
    name: author.name,
    email: author.email,
    linesAlive: author.linesAlive,
    linesAdded: author.linesAdded,
    linesDeleted: author.linesDeleted,
    linesNet: author.linesAdded - author.linesDeleted,
    commits: author.commits,
    files: author.files,
    percentAlive: formatPercent(author.linesAlive, totalAlive),
  }));
};
