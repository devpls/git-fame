import { render } from '../../src/render/index.js';
import { prepareAuthors } from '../../src/render/helpers/prepare-authors.js';
import { summarize } from '../../src/summarize/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import type { Report } from '../../src/types/report.type.js';

const quoteCSV = (value: string): string => {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

export const buildMultiRepoCSV = (
  reports: Report[],
  renderOptions: RenderOptions | undefined,
  doSummary: boolean,
): string => {
  if (doSummary) {
    const summaryData = summarize(reports);
    return render(summaryData, 'csv', renderOptions);
  }

  const header =
    'repo,author,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive';
  const rows: string[] = [header];
  for (const report of reports) {
    const authors = prepareAuthors(report, renderOptions);
    for (const a of authors) {
      const author = quoteCSV(`${a.name} <${a.email}>`);
      rows.push(
        `${quoteCSV(report.repo.path)},${author},${String(a.linesAlive)},${String(a.linesAdded)},${String(a.linesDeleted)},${String(a.linesNet)},${String(a.commits)},${String(a.files)},${a.percentAlive}`,
      );
    }
  }
  return rows.join('\n');
};
