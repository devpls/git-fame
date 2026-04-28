import type { Summary } from '../../types/summary.type.js';
import type { RenderOptions } from '../types/render-options.type.js';
import {
  type PreparedSummaryAuthor,
  prepareSummaryAuthors,
} from '../helpers/prepare-summary-authors.js';
import { renderSummaryBreakdownMarkdown } from './render-summary-breakdown-markdown.js';

const escapeCell = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/</g, '\\<').replace(/>/g, '\\>');

const authorCell = (author: PreparedSummaryAuthor): string =>
  escapeCell(`${author.name} <${author.email}>`);

const mainRow = (author: PreparedSummaryAuthor): string =>
  `| ${authorCell(author)} | ${String(author.linesAlive)} | ${String(author.linesAdded)} | ${String(author.linesDeleted)} | ${String(author.linesNet)} | ${String(author.commits)} | ${String(author.files)} | ${author.percentAlive} |`;

const detailRow = (
  author: PreparedSummaryAuthor,
  r: PreparedSummaryAuthor['perRepo'][number],
): string =>
  `| ${authorCell(author)} | ${escapeCell(r.path)} | ${String(r.linesAlive)} | ${String(r.linesAdded)} | ${String(r.linesDeleted)} | ${String(r.linesAdded - r.linesDeleted)} | ${String(r.commits)} | ${String(r.files)} |`;

export const renderSummaryMarkdown = (summary: Summary, options?: RenderOptions): string => {
  const authors = prepareSummaryAuthors(summary, options);
  const t = summary.totals;

  const mainHeader = '| Author | Lines | Added | Deleted | Net | Commits | Files | % Alive |';
  const mainSep = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const mainRows = authors.map(mainRow);

  const detailHeader = '| Author | Repo | Lines | Added | Deleted | Net | Commits | Files |';
  const detailSep = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const detailRows: string[] = [];
  for (const a of authors) {
    for (const r of a.perRepo) {
      detailRows.push(detailRow(a, r));
    }
  }

  const parts = [
    `## Summary (${String(summary.meta.repoCount)} repos)`,
    '',
    `Totals: ${String(t.linesAlive)} lines | ${String(t.commits)} commits | ${String(t.files)} files`,
    '',
    mainHeader,
    mainSep,
    ...mainRows,
    '',
    '### Per-repo breakdown',
    '',
    detailHeader,
    detailSep,
    ...detailRows,
  ];

  if (summary.breakdown !== undefined && summary.breakdown.length > 0) {
    parts.push('', '### Group breakdown', '', renderSummaryBreakdownMarkdown(summary.breakdown));
  }

  return parts.join('\n');
};
