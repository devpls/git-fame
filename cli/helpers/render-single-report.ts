import { render, renderBreakdown } from '../../src/render/index.js';
import type { RenderFormat } from '../../src/render/index.js';
import type { RenderOptions } from '../../src/render/types/render-options.type.js';
import type { Report } from '../../src/types/report.type.js';

export const renderSingleReport = (
  report: Report,
  format: RenderFormat,
  renderOptions: RenderOptions | undefined,
  perAuthor: boolean,
): string => {
  let text = render(report, format, renderOptions);
  if (!perAuthor && format !== 'json') {
    const breakdownOutput = renderBreakdown(report, format);
    if (breakdownOutput !== undefined) {
      text += '\n' + breakdownOutput;
    }
  }
  return text;
};
