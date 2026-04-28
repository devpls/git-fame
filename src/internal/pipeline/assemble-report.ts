import type { Aggregator } from '../identity/aggregator/index.js';
import type { Report } from '../../types/report.type.js';
import { version as NODE_FAME_VERSION } from '../../version.js';

export interface AssembleContext {
  path: string;
  headSha: string;
  headRef: string;
  startedAt: Date;
  durationMs: number;
  range?: {
    fromSha: string;
    toSha: string;
    fromRef: string;
    toRef: string;
  };
}

export const assembleReport = (aggregator: Aggregator, ctx: AssembleContext): Report =>
  aggregator.build(
    {
      version: NODE_FAME_VERSION,
      generatedAt: ctx.startedAt,
      durationMs: ctx.durationMs,
      cached: false,
    },
    {
      path: ctx.path,
      headSha: ctx.headSha,
      headRef: ctx.headRef,
      ...(ctx.range !== undefined && { range: ctx.range }),
      totals: { lines: 0, commits: 0, files: 0 },
    },
  );
