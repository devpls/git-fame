export interface AnalyzeOptions {
  path: string;

  include?: {
    whitespace?: boolean;
    binary?: boolean;
    generated?: boolean;
  };

  options?: {
    followRenames?: boolean;
    applyMailmap?: boolean;
  };
}
