import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';
import type { Report } from '../../types/report.type.js';
import type { Warning } from '../../types/warning.type.js';
import type { RenderOptions } from '../types/render-options.type.js';
import { prepareAuthors } from './prepare-authors.js';
import type { PreparedAuthor } from './prepare-authors.js';

export interface ReportDto {
  meta: {
    version: string;
    generatedAt: Date;
    durationMs: number;
  };
  repo: Report['repo'];
  authors: PreparedAuthor[];
  warnings: Warning[];
  breakdown?: BreakdownEntry[];
}

export const buildReportDto = (report: Report, options?: RenderOptions): ReportDto => {
  const authors = prepareAuthors(report, options);
  return {
    meta: {
      version: report.meta.version,
      generatedAt: report.meta.generatedAt,
      durationMs: report.meta.durationMs,
    },
    repo: report.repo,
    authors,
    warnings: report.warnings,
    ...(report.breakdown !== undefined ? { breakdown: report.breakdown } : {}),
  };
};
