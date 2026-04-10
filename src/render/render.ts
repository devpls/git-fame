import type { Report } from '../types/report.type.js';
import type { RenderOptions } from './types/render-options.type.js';
import { renderTable } from './table/index.js';
import { renderJson } from './json/index.js';
import { renderCsv } from './csv/index.js';
import { renderMarkdown } from './markdown/index.js';
import {
  renderBreakdownTable,
  renderBreakdownJson,
  renderBreakdownCsv,
  renderBreakdownMarkdown,
} from './breakdown/index.js';

export type RenderFormat = 'table' | 'json' | 'csv' | 'markdown';

export const render = (report: Report, format: RenderFormat, options?: RenderOptions): string => {
  // use string comparison to avoid no-unnecessary-condition with narrow union
  const f: string = format;
  if (f === 'table') return renderTable(report, options);
  if (f === 'json') return renderJson(report, options);
  if (f === 'csv') return renderCsv(report, options);
  if (f === 'markdown') return renderMarkdown(report, options);
  throw new Error(`render: unsupported format '${f}'`);
};

export const renderBreakdown = (report: Report, format: RenderFormat): string | undefined => {
  if (report.breakdown === undefined || report.breakdown.length === 0) {
    return undefined;
  }
  const f: string = format;
  if (f === 'table') return renderBreakdownTable(report.breakdown);
  if (f === 'json') return renderBreakdownJson(report.breakdown);
  if (f === 'csv') return renderBreakdownCsv(report.breakdown);
  if (f === 'markdown') return renderBreakdownMarkdown(report.breakdown);
  return undefined;
};
