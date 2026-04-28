import Table from 'cli-table3';
import type { Summary } from '../../types/summary.type.js';
import type { RenderOptions } from '../types/render-options.type.js';
import { prepareSummaryAuthors } from '../helpers/prepare-summary-authors.js';
import { renderSummaryBreakdownTable } from './render-summary-breakdown-table.js';

export const renderSummaryTable = (summary: Summary, options?: RenderOptions): string => {
  const authors = prepareSummaryAuthors(summary, options);
  const t = summary.totals;

  const mainTable = new Table({
    head: ['Author', 'Lines', 'Added', 'Deleted', 'Commits', 'Files', '% Alive'],
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
  });
  for (const a of authors) {
    mainTable.push([
      `${a.name} <${a.email}>`,
      String(a.linesAlive),
      String(a.linesAdded),
      String(a.linesDeleted),
      String(a.commits),
      String(a.files),
      `${a.percentAlive}%`,
    ]);
  }

  const detailTable = new Table({
    head: ['Author', 'Repo', 'Lines', 'Added', 'Deleted', 'Commits', 'Files'],
    colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
  });
  for (const a of authors) {
    for (const r of a.perRepo) {
      detailTable.push([
        `${a.name} <${a.email}>`,
        r.path,
        String(r.linesAlive),
        String(r.linesAdded),
        String(r.linesDeleted),
        String(r.commits),
        String(r.files),
      ]);
    }
  }

  const parts = [
    `=== Summary (${String(summary.meta.repoCount)} repos) ===`,
    '',
    `Totals: ${String(t.linesAlive)} lines | ${String(t.commits)} commits | ${String(t.files)} files`,
    '',
    mainTable.toString(),
    '',
    'Per-repo breakdown:',
    detailTable.toString(),
  ];

  if (summary.breakdown !== undefined && summary.breakdown.length > 0) {
    parts.push('', 'Group breakdown:', renderSummaryBreakdownTable(summary.breakdown));
  }

  return parts.join('\n');
};
