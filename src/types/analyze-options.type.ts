import type { ProgressEvent } from './progress-event.type.js';

export interface AnalyzeOptions {
  path: string;

  /** Single commit-ish to analyze. Default: 'HEAD'. Mutually exclusive with `range`. */
  rev?: string;

  /** Commit range to analyze. Mutually exclusive with `rev`. */
  range?: {
    from: string;
    to: string;
  };

  /** Only count log entries after this date. Blame is always at the upper ref. */
  since?: Date;

  /** Only count log entries before this date. Blame is always at the upper ref. */
  until?: Date;

  include?: {
    whitespace?: boolean;
    binary?: boolean;
    generated?: boolean;
    minified?: boolean;
  };

  options?: {
    followRenames?: boolean;
    applyMailmap?: boolean;
  };

  includeGlobs?: string[];
  excludeGlobs?: string[];
  concurrency?: number;
  cache?: boolean;
  onProgress?: (event: ProgressEvent) => void;
  submodules?: boolean;
  groupBy?: {
    type: 'extension' | 'directory';
    depth: number;
  };
}
