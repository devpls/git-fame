import type { Report } from '../../types/report.type.js';
import { buildReportDto } from '../helpers/build-report-dto.js';
import { jsonReplacer } from '../helpers/json-replacer.js';
import type { RenderOptions } from '../types/render-options.type.js';

export const renderJson = (report: Report, options?: RenderOptions): string => {
  const dto = buildReportDto(report, options);
  return JSON.stringify(dto, jsonReplacer, 2);
};
