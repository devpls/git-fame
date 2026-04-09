export interface AnalyzeOptions {
  path: string;

  include?: {
    whitespace?: boolean;
    binary?: boolean;
    generated?: boolean;
    /** Include minified files. Default: true (minified ARE counted by default). */
    minified?: boolean;
  };

  options?: {
    followRenames?: boolean;
    applyMailmap?: boolean;
  };

  /** Only analyze files matching at least one of these globs. Empty = all files. */
  includeGlobs?: string[];
  /** Exclude files matching any of these globs. Exclude wins over include. */
  excludeGlobs?: string[];
}
