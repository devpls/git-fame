import type { Report } from '../types/report.type.js';
import type { RenderOptions } from './types/render-options.type.js';
import { renderTable } from './table/index.js';
import { renderJson } from './json/index.js';
import { renderCsv } from './csv/index.js';
import { renderMarkdown } from './markdown/index.js';

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
