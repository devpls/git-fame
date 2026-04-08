import Table from 'cli-table3';
import type { AuthorStats } from '../../types/author-stats.type.js';
import type { Report } from '../../types/report.type.js';

const formatPercent = (value: number, total: number): string => {
  if (total === 0) {
    return '0.0';
  }
  return ((value / total) * 100).toFixed(1);
};

const authorRow = (author: AuthorStats, totalLinesAlive: number): string[] => [
  `${author.name} <${author.email}>`,
  String(author.linesAlive),
  String(author.linesAdded),
  String(author.linesDeleted),
  String(author.commits),
  String(author.files),
  formatPercent(author.linesAlive, totalLinesAlive),
];

export const renderTable = (report: Report): string => {
  const sorted = [...report.authors].sort((a, b) => b.linesAlive - a.linesAlive);
  const totalLinesAlive = sorted.reduce((acc, author) => acc + author.linesAlive, 0);

  const table = new Table({
    head: [
      'author',
      'linesAlive',
      'linesAdded',
      'linesDeleted',
      'commits',
      'files',
      'percentAlive',
    ],
  });

  for (const author of sorted) {
    table.push(authorRow(author, totalLinesAlive));
  }

  return table.toString();
};
