import { writeFileSync } from 'node:fs';
import { render } from '../../src/render/index.js';
import type { RenderFormat } from '../../src/render/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import { summarize } from '../../src/summarize/index.js';
import type { Report } from '../../src/types/report.type.js';
import { buildMultiRepoCSV } from './build-multi-repo-csv.js';
import { buildMultiRepoJsonEnvelope } from './build-multi-repo-json-envelope.js';
import { renderSingleReport } from './render-single-report.js';

export const writeManyToFile = (
  reports: Report[],
  filePath: string,
  format: string,
  renderFormat: RenderFormat,
  renderOptions: RenderOptions | undefined,
  perAuthor: boolean,
  doSummary: boolean,
  generatedAt: Date,
): void => {
  if (format === 'json') {
    const envelope = buildMultiRepoJsonEnvelope(reports, renderOptions, doSummary, generatedAt);
    writeFileSync(filePath, envelope, 'utf8');
    return;
  }

  if (format === 'csv') {
    writeFileSync(filePath, buildMultiRepoCSV(reports, renderOptions, doSummary) + '\n', 'utf8');
    return;
  }

  const parts: string[] = [];
  for (const report of reports) {
    parts.push(`=== ${report.repo.path} ===`);
    parts.push(renderSingleReport(report, renderFormat, renderOptions, perAuthor));
  }
  if (doSummary) {
    const summaryData = summarize(reports);
    parts.push(render(summaryData, renderFormat, renderOptions));
  }
  writeFileSync(filePath, parts.join('\n') + '\n', 'utf8');
};
