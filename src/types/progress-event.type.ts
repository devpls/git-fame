export type ProgressEvent =
  | { type: 'phase'; phase: 'discover' | 'log' | 'blame' | 'aggregate'; path: string }
  | { type: 'blame'; file: string; done: number; total: number };
