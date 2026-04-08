import type { Report } from '../types/report.type.js';
import { renderTable } from './table/index.js';

export type RenderFormat = 'table';

export const render = (report: Report, format: RenderFormat): string => {
  const f: string = format;
  if (f === 'table') {
    return renderTable(report);
  }
  throw new Error(`render: unsupported format '${f}'`);
};
