import { render } from '../../src/render/index.js';
import type { RenderFormat } from '../../src/render/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import { summarize } from '../../src/summarize/index.js';
import type { Report } from '../../src/types/report.type.js';
import { buildMultiRepoCSV } from './build-multi-repo-csv.js';
import { buildMultiRepoJsonEnvelope } from './build-multi-repo-json-envelope.js';
import { renderSingleReport } from './render-single-report.js';

export const writeManyToStdout = (
  reports: Report[],
  format: string,
  renderFormat: RenderFormat,
  renderOptions: RenderOptions | undefined,
  perAuthor: boolean,
  doSummary: boolean,
  generatedAt: Date,
): void => {
  if (format === 'json') {
    const envelope = buildMultiRepoJsonEnvelope(reports, renderOptions, doSummary, generatedAt);
    process.stdout.write(envelope + '\n');
    return;
  }

  if (format === 'csv') {
    process.stdout.write(buildMultiRepoCSV(reports, renderOptions, doSummary) + '\n');
    return;
  }

  for (const report of reports) {
    process.stdout.write(`\n=== ${report.repo.path} ===\n`);
    process.stdout.write(renderSingleReport(report, renderFormat, renderOptions, perAuthor) + '\n');
  }
  if (doSummary) {
    const summaryData = summarize(reports);
    process.stdout.write('\n');
    process.stdout.write(render(summaryData, renderFormat, renderOptions) + '\n');
  }
};
