import { buildReportDto } from '../../src/render/helpers/build-report-dto.js';
import { buildSummaryDto } from '../../src/render/helpers/build-summary-dto.js';
import { jsonReplacer } from '../../src/render/helpers/json-replacer.js';
import { summarize } from '../../src/summarize/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import type { Report } from '../../src/types/report.type.js';

export const buildMultiRepoJsonEnvelope = (
  reports: Report[],
  renderOptions: RenderOptions | undefined,
  doSummary: boolean,
  generatedAt: Date,
): string => {
  const dtos = reports.map((r) => buildReportDto(r, renderOptions));
  const first = reports[0];
  if (first === undefined) {
    throw new Error('reports must be non-empty');
  }
  const envelope: Record<string, unknown> = {
    meta: {
      version: first.meta.version,
      generatedAt,
      repoCount: reports.length,
    },
    reports: dtos,
  };
  if (doSummary) {
    const summaryDto = buildSummaryDto(summarize(reports), renderOptions);
    summaryDto.meta = { ...summaryDto.meta, generatedAt };
    envelope.summary = summaryDto;
  }
  return JSON.stringify(envelope, jsonReplacer, 2);
};
