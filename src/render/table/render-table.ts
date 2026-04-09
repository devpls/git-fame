import Table from 'cli-table3';
import type { Report } from '../../types/report.type.js';
import { prepareAuthors } from '../helpers/prepare-authors.js';
import type { RenderOptions } from '../types/render-options.type.js';

export const renderTable = (report: Report, options?: RenderOptions): string => {
  const prepared = prepareAuthors(report, options);

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

  for (const author of prepared) {
    table.push([
      `${author.name} <${author.email}>`,
      String(author.linesAlive),
      String(author.linesAdded),
      String(author.linesDeleted),
      String(author.commits),
      String(author.files),
      author.percentAlive,
    ]);
  }

  return table.toString();
};
