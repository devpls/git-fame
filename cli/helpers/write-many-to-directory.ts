import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../../src/render/index.js';
import type { RenderFormat } from '../../src/render/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import { summarize } from '../../src/summarize/index.js';
import type { Report } from '../../src/types/report.type.js';
import { generateFilename } from './generate-filename.js';
import { generateSummaryFilename } from './generate-summary-filename.js';
import { renderSingleReport } from './render-single-report.js';

export const writeManyToDirectory = (
  reports: Report[],
  dirPath: string,
  format: string,
  renderFormat: RenderFormat,
  renderOptions: RenderOptions | undefined,
  perAuthor: boolean,
  scanRoot: string,
  doSummary: boolean,
  timestamp: string,
): void => {
  mkdirSync(dirPath, { recursive: true });

  for (const report of reports) {
    const filename = generateFilename(report.repo.path, scanRoot, timestamp, format);
    const content = renderSingleReport(report, renderFormat, renderOptions, perAuthor);
    writeFileSync(join(dirPath, filename), content + '\n', 'utf8');
  }

  if (doSummary) {
    const summaryData = summarize(reports);
    const summaryFilename = generateSummaryFilename(timestamp, format);
    const summaryContent = render(summaryData, renderFormat, renderOptions);
    writeFileSync(join(dirPath, summaryFilename), summaryContent + '\n', 'utf8');
  }
};
