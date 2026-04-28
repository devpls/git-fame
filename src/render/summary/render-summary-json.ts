import type { Summary } from '../../types/summary.type.js';
import { buildSummaryDto } from '../helpers/build-summary-dto.js';
import { jsonReplacer } from '../helpers/json-replacer.js';
import type { RenderOptions } from '../types/render-options.type.js';

export const renderSummaryJson = (summary: Summary, options?: RenderOptions): string =>
  JSON.stringify(buildSummaryDto(summary, options), jsonReplacer, 2);
