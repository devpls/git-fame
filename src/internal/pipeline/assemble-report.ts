import type { Aggregator } from '../identity/aggregator/index.js';
import type { Report } from '../../types/report.type.js';

const NODE_FAME_VERSION = '0.1.0';

export interface AssembleContext {
  path: string;
  headSha: string;
  headRef: string;
  startedAt: Date;
  durationMs: number;
}

export const assembleReport = (aggregator: Aggregator, ctx: AssembleContext): Report =>
  aggregator.build(
    {
      version: NODE_FAME_VERSION,
      generatedAt: ctx.startedAt,
      durationMs: ctx.durationMs,
    },
    {
      path: ctx.path,
      headSha: ctx.headSha,
      headRef: ctx.headRef,
      totals: { lines: 0, commits: 0, files: 0 },
    },
  );
