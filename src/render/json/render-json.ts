import { prepareAuthors } from '../helpers/prepare-authors.js';
import type { RenderOptions } from '../types/render-options.type.js';
import type { Report } from '../../types/report.type.js';

const replacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

export const renderJson = (report: Report, options?: RenderOptions): string => {
  const authors = prepareAuthors(report, options);

  const output = {
    meta: {
      version: report.meta.version,
      generatedAt: report.meta.generatedAt,
      durationMs: report.meta.durationMs,
    },
    repo: report.repo,
    authors,
    warnings: report.warnings,
  };

  return JSON.stringify(output, replacer, 2);
};
