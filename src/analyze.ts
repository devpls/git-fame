import { Aggregator } from './internal/identity/aggregator/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  const startedAt = new Date();
  const startMs = Date.now();

  const discovered = await discover(options.path);
  const aggregator = new Aggregator();

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  await Promise.all([
    runLogPhase(options.path, aggregator),
    runBlamePhase(options.path, discovered.files, aggregator),
  ]);

  const durationMs = Date.now() - startMs;

  return assembleReport(aggregator, {
    path: options.path,
    headSha: discovered.headSha,
    headRef: discovered.headRef,
    startedAt,
    durationMs,
  });
};
