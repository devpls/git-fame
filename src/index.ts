export const version = '0.1.0';

export {
  AbortError,
  ConflictingOptionsError,
  GitCommandError,
  GitNotInstalledError,
  InvalidRevError,
  NodeFameError,
  NotAGitRepoError,
} from './errors/index.js';

export { analyze } from './analyze.js';
export { render, type RenderFormat } from './render/index.js';

export type { AnalyzeOptions } from './types/analyze-options.type.js';
export type { AuthorStats } from './types/author-stats.type.js';
export type { Report } from './types/report.type.js';
export type { Warning } from './types/warning.type.js';
