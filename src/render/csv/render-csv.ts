import { prepareAuthors } from '../helpers/prepare-authors.js';
import type { PreparedAuthor } from '../helpers/prepare-authors.js';
import type { RenderOptions } from '../types/render-options.type.js';
import type { Report } from '../../types/report.type.js';

const HEADER = 'author,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive';

const quoteField = (value: string): string => {
  if (!value.includes(',') && !value.includes('"')) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const authorField = (author: PreparedAuthor): string =>
  quoteField(`${author.name} <${author.email}>`);

const authorRow = (author: PreparedAuthor): string =>
  [
    authorField(author),
    String(author.linesAlive),
    String(author.linesAdded),
    String(author.linesDeleted),
    String(author.linesNet),
    String(author.commits),
    String(author.files),
    author.percentAlive,
  ].join(',');

export const renderCsv = (report: Report, options?: RenderOptions): string => {
  const authors = prepareAuthors(report, options);
  const rows = authors.map(authorRow);
  return [HEADER, ...rows].join('\n');
};
