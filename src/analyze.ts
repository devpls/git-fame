import { Aggregator } from './internal/identity/aggregator/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

interface ResolvedDefaults {
  includeGenerated: boolean;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const resolveDefaults = (options: AnalyzeOptions): ResolvedDefaults => ({
  includeGenerated: options.include?.generated ?? false,
  followRenames: options.options?.followRenames ?? true,
  // include.whitespace=true means "count whitespace lines" → do NOT ignore whitespace (no -w)
  // include.whitespace=false (default) means "ignore whitespace" → pass -w
  ignoreWhitespace: !(options.include?.whitespace ?? false),
});

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  const startedAt = new Date();
  const startMs = Date.now();

  const { includeGenerated, followRenames, ignoreWhitespace } = resolveDefaults(options);

  const discovered = await discover(options.path, { includeGenerated });
  const aggregator = new Aggregator();

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  await Promise.all([
    runLogPhase(options.path, aggregator),
    runBlamePhase(options.path, discovered.files, aggregator, { followRenames, ignoreWhitespace }),
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
