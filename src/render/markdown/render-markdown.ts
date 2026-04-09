import { prepareAuthors } from '../helpers/prepare-authors.js';
import type { PreparedAuthor } from '../helpers/prepare-authors.js';
import type { RenderOptions } from '../types/render-options.type.js';
import type { Report } from '../../types/report.type.js';

const HEADER_ROW =
  '| author | linesAlive | linesAdded | linesDeleted | linesNet | commits | files | percentAlive |';
const SEPARATOR_ROW = '| --- | --- | --- | --- | --- | --- | --- | --- |';

const escapeAuthor = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/</g, '\\<').replace(/>/g, '\\>');

const authorCell = (author: PreparedAuthor): string =>
  escapeAuthor(`${author.name} <${author.email}>`);

const authorRow = (author: PreparedAuthor): string =>
  `| ${authorCell(author)} | ${String(author.linesAlive)} | ${String(author.linesAdded)} | ${String(author.linesDeleted)} | ${String(author.linesNet)} | ${String(author.commits)} | ${String(author.files)} | ${author.percentAlive} |`;

export const renderMarkdown = (report: Report, options?: RenderOptions): string => {
  const authors = prepareAuthors(report, options);
  const rows = authors.map(authorRow);
  return [HEADER_ROW, SEPARATOR_ROW, ...rows].join('\n');
};
