import type { Summary } from '../../types/summary.type.js';
import type { RenderOptions } from '../types/render-options.type.js';
import {
  type PreparedSummaryAuthor,
  prepareSummaryAuthors,
} from '../helpers/prepare-summary-authors.js';

const HEADER =
  'section,author,repo,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive';

const quoteField = (value: string): string => {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const authorField = (author: PreparedSummaryAuthor): string =>
  quoteField(`${author.name} <${author.email}>`);

const summaryRow = (author: PreparedSummaryAuthor): string =>
  [
    'summary',
    authorField(author),
    '',
    String(author.linesAlive),
    String(author.linesAdded),
    String(author.linesDeleted),
    String(author.linesNet),
    String(author.commits),
    String(author.files),
    author.percentAlive,
  ].join(',');

const detailRow = (
  author: PreparedSummaryAuthor,
  repoPath: string,
  r: PreparedSummaryAuthor['perRepo'][number],
): string =>
  [
    'detail',
    authorField(author),
    quoteField(repoPath),
    String(r.linesAlive),
    String(r.linesAdded),
    String(r.linesDeleted),
    String(r.linesAdded - r.linesDeleted),
    String(r.commits),
    String(r.files),
    '',
  ].join(',');

export const renderSummaryCsv = (summary: Summary, options?: RenderOptions): string => {
  const authors = prepareSummaryAuthors(summary, options);
  const summaryRows = authors.map(summaryRow);
  const detailRows: string[] = [];
  for (const author of authors) {
    for (const r of author.perRepo) {
      detailRows.push(detailRow(author, r.path, r));
    }
  }

  return [HEADER, ...summaryRows, ...detailRows].join('\n');
};
