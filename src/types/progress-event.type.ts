export type ProgressEvent =
  | { type: 'phase'; phase: 'discover' | 'log' | 'blame' | 'aggregate' }
  | { type: 'blame'; file: string; done: number; total: number };
