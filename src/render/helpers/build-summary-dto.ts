import type { Summary } from '../../types/summary.type.js';
import type { RenderOptions } from '../types/render-options.type.js';
import { type PreparedSummaryAuthor, prepareSummaryAuthors } from './prepare-summary-authors.js';

export interface SummaryDto {
  meta: Summary['meta'];
  repos: Summary['repos'];
  totals: Summary['totals'];
  authors: PreparedSummaryAuthor[];
  warnings: Summary['warnings'];
  breakdown?: Summary['breakdown'];
}

export const buildSummaryDto = (summary: Summary, options?: RenderOptions): SummaryDto => {
  const authors = prepareSummaryAuthors(summary, options);
  return {
    meta: summary.meta,
    repos: summary.repos,
    totals: summary.totals,
    authors,
    warnings: summary.warnings,
    ...(summary.breakdown !== undefined ? { breakdown: summary.breakdown } : {}),
  };
};
