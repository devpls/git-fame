export { version } from './version.js';

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
export { analyzeMany } from './analyze-many.js';
export { render, type RenderFormat } from './render/index.js';
export { summarize } from './summarize/index.js';

export type { AnalyzeOptions } from './types/analyze-options.type.js';
export type { AnalyzeManyOptions } from './types/analyze-many-options.type.js';
export type { AuthorStats } from './types/author-stats.type.js';
export type { BreakdownEntry } from './types/breakdown-entry.type.js';
export type { Report } from './types/report.type.js';
export type { Warning } from './types/warning.type.js';
export type { Summary } from './types/summary.type.js';
export type { SummaryAuthor } from './types/summary-author.type.js';
export type { RepoWarning } from './types/repo-warning.type.js';
