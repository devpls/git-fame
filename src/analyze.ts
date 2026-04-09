import { join } from 'node:path';
import { ConflictingOptionsError } from './errors/conflicting-options.error.js';
import { Aggregator } from './internal/identity/aggregator/index.js';
import { discoverSubmodules } from './internal/git/discover-submodules.js';
import { loadMailmap } from './internal/identity/mailmap/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { LogPhaseOptions } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

interface ResolvedDefaults {
  includeGenerated: boolean;
  includeMinified: boolean;
  followRenames: boolean;
  ignoreWhitespace: boolean;
  applyMailmap: boolean;
  includeGlobs: string[];
  excludeGlobs: string[];
}

const resolveDefaults = (options: AnalyzeOptions): ResolvedDefaults => ({
  includeGenerated: options.include?.generated ?? false,
  includeMinified: options.include?.minified ?? true,
  followRenames: options.options?.followRenames ?? true,
  // include.whitespace=true means "count whitespace lines" → do NOT ignore whitespace (no -w)
  // include.whitespace=false (default) means "ignore whitespace" → pass -w
  ignoreWhitespace: !(options.include?.whitespace ?? false),
  applyMailmap: options.options?.applyMailmap ?? true,
  includeGlobs: options.includeGlobs ?? [],
  excludeGlobs: options.excludeGlobs ?? [],
});

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  if (options.rev !== undefined && options.range !== undefined) {
    throw new ConflictingOptionsError("'rev' and 'range' are mutually exclusive");
  }

  const startedAt = new Date();
  const startMs = Date.now();

  const {
    includeGenerated,
    includeMinified,
    followRenames,
    ignoreWhitespace,
    applyMailmap,
    includeGlobs,
    excludeGlobs,
  } = resolveDefaults(options);

  options.onProgress?.({ type: 'phase', phase: 'discover' });
  const discovered = await discover(options.path, {
    includeGenerated,
    includeMinified,
    includeGlobs,
    excludeGlobs,
    ...(options.rev !== undefined && { rev: options.rev }),
    ...(options.range !== undefined && { range: options.range }),
  });
  const mailmap = applyMailmap ? loadMailmap(options.path) : undefined;
  const aggregator = new Aggregator(mailmap);

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  options.onProgress?.({ type: 'phase', phase: 'log' });
  const logOptions: LogPhaseOptions = {
    ...(discovered.range !== undefined && {
      range: { fromSha: discovered.range.fromSha, toSha: discovered.range.toSha },
    }),
    ...(options.since !== undefined && { since: options.since }),
    ...(options.until !== undefined && { until: options.until }),
  };

  options.onProgress?.({ type: 'phase', phase: 'blame' });
  await Promise.all([
    runLogPhase(options.path, aggregator, logOptions),
    runBlamePhase(
      options.path,
      discovered.files,
      aggregator,
      { rev: discovered.headSha, followRenames, ignoreWhitespace },
      options.onProgress,
    ),
  ]);

  if (options.submodules === true) {
    const submodules = discoverSubmodules(options.path);
    for (const sub of submodules) {
      if (!sub.initialized) {
        aggregator.recordWarning({
          code: 'UNINIT_SUBMODULE',
          path: sub.path,
          message: `submodule ${sub.path} is not initialized; skipped`,
        });
        continue;
      }
      const subReport = await analyze({
        ...options,
        path: join(options.path, sub.path),
        submodules: false, // prevent infinite recursion
      });
      for (const author of subReport.authors) {
        aggregator.mergeAuthorStats(author);
      }
      for (const warning of subReport.warnings) {
        aggregator.recordWarning(warning);
      }
    }
  }

  options.onProgress?.({ type: 'phase', phase: 'aggregate' });
  const durationMs = Date.now() - startMs;

  return assembleReport(aggregator, {
    path: options.path,
    headSha: discovered.headSha,
    headRef: discovered.headRef,
    startedAt,
    durationMs,
    ...(discovered.range !== undefined && { range: discovered.range }),
  });
};
