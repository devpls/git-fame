import type { AnalyzeOptions } from './analyze-options.type.js';

export interface AnalyzeManyOptions extends AnalyzeOptions {
  recursive?: boolean;
  splitSubmodules?: boolean;
}
