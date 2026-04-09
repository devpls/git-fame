import { Command } from 'commander';
import type { AnalyzeOptions } from '../src/types/analyze-options.type.js';
import type { RenderOptions, SortableColumn } from '../src/render/index.js';
import { loadConfig } from '../src/internal/config/load-config.js';

export interface ParsedFlags {
  options: AnalyzeOptions;
  format: string;
  renderOptions: RenderOptions;
  recursive: boolean;
  splitSubmodules: boolean;
}

export const parseFlags = (argv: string[]): ParsedFlags => {
  const program = new Command()
    .name('node-fame')
    .version('0.1.0')
    .description('Fast, accurate git contribution stats — lines, commits, files per author.')
    .argument('[path]', 'Repository path', process.cwd())
    .option('--include-whitespace', 'Count whitespace-only changes as meaningful')
    .option('--include-binary', 'Include binary files in analysis')
    .option('--include-generated', 'Include generated/vendored files (lock files, dist/, etc.)')
    .option('--exclude-minified', 'Exclude minified files (avg line length > 500 chars)')
    .option('--no-follow-renames', 'Do not follow renames/copies in git blame')
    .option('--no-mailmap', 'Do not apply .mailmap for identity canonicalisation')
    .option('--include-globs <patterns...>', 'Only analyze files matching these glob patterns')
    .option('--exclude-globs <patterns...>', 'Exclude files matching these glob patterns')
    .option('--format <format>', 'Output format (table)', 'table')
    .option(
      '--sort <column>',
      'Sort by column (linesAlive, linesAdded, linesDeleted, commits, files)',
      'linesAlive',
    )
    .option('--limit <n>', 'Show only top N authors', parseInt)
    .option('--rev <ref>', 'Analyze at a specific commit, tag, or branch')
    .option('--from <ref>', 'Start of commit range (used with --to)')
    .option('--to <ref>', 'End of commit range (used with --from)')
    .option('--since <date>', 'Only count log entries after this date (ISO 8601)')
    .option('--until <date>', 'Only count log entries before this date (ISO 8601)')
    .option('--concurrency <n>', 'Number of parallel blame workers (default: cpus * 1.2)', parseInt)
    .option('--no-cache', 'Disable result caching')
    .option('--submodules', 'Walk into submodules')
    .option('--split-submodules', 'Output separate reports per submodule (implies --submodules)')
    .option('--recursive', 'Analyze all git repos in subdirectories')
    .exitOverride()
    .parse(argv);

  const opts = program.opts();
  const path = program.args[0] ?? process.cwd();

  const config = loadConfig(path);

  const include: AnalyzeOptions['include'] = {
    whitespace:
      (opts.includeWhitespace as boolean | undefined) ?? config.includeWhitespace ?? false,
    binary: (opts.includeBinary as boolean | undefined) ?? config.includeBinary ?? false,
    generated: (opts.includeGenerated as boolean | undefined) ?? config.includeGenerated ?? false,
  };
  if (
    (opts.excludeMinified as boolean | undefined) === true ||
    (config.excludeMinified === true && (opts.excludeMinified as boolean | undefined) === undefined)
  ) {
    include.minified = false;
  }

  const followRenamesSource = program.getOptionValueSource('followRenames');
  const mailmapSource = program.getOptionValueSource('mailmap');

  const analyzeOptions: AnalyzeOptions = {
    path,
    include,
    options: {
      followRenames:
        followRenamesSource === 'cli'
          ? (opts.followRenames as boolean)
          : (config.followRenames ?? true),
      applyMailmap: mailmapSource === 'cli' ? (opts.mailmap as boolean) : (config.mailmap ?? true),
    },
  };

  const cliGlobs = opts.includeGlobs as string[] | undefined;
  if (cliGlobs !== undefined) {
    analyzeOptions.includeGlobs = cliGlobs;
  } else if (config.includeGlobs !== undefined) {
    analyzeOptions.includeGlobs = config.includeGlobs;
  }

  const cliExclude = opts.excludeGlobs as string[] | undefined;
  if (cliExclude !== undefined) {
    analyzeOptions.excludeGlobs = cliExclude;
  } else if (config.excludeGlobs !== undefined) {
    analyzeOptions.excludeGlobs = config.excludeGlobs;
  }

  if ((opts.rev as string | undefined) !== undefined) {
    analyzeOptions.rev = opts.rev as string;
  } else if (config.rev !== undefined) {
    analyzeOptions.rev = config.rev;
  }

  const cliFrom = opts.from as string | undefined;
  const cliTo = opts.to as string | undefined;
  if (cliFrom !== undefined && cliTo !== undefined) {
    analyzeOptions.range = { from: cliFrom, to: cliTo };
  } else if (config.from !== undefined && config.to !== undefined) {
    analyzeOptions.range = { from: config.from, to: config.to };
  }

  if ((opts.since as string | undefined) !== undefined) {
    analyzeOptions.since = new Date(opts.since as string);
  } else if (config.since !== undefined) {
    analyzeOptions.since = new Date(config.since);
  }

  if ((opts.until as string | undefined) !== undefined) {
    analyzeOptions.until = new Date(opts.until as string);
  } else if (config.until !== undefined) {
    analyzeOptions.until = new Date(config.until);
  }

  const cliConcurrency = opts.concurrency as number | undefined;
  if (cliConcurrency !== undefined && !isNaN(cliConcurrency)) {
    analyzeOptions.concurrency = cliConcurrency;
  } else if (config.concurrency !== undefined) {
    analyzeOptions.concurrency = config.concurrency;
  }

  const cacheSource = program.getOptionValueSource('cache');
  analyzeOptions.cache = cacheSource === 'cli' ? (opts.cache as boolean) : (config.cache ?? true);

  const submodules = (opts.submodules as boolean | undefined) ?? config.submodules ?? false;
  const splitSubmodules =
    (opts.splitSubmodules as boolean | undefined) ?? config.splitSubmodules ?? false;
  const recursive = (opts.recursive as boolean | undefined) ?? config.recursive ?? false;

  if (submodules || splitSubmodules) {
    analyzeOptions.submodules = true;
  }

  const formatSource = program.getOptionValueSource('format');
  const format =
    formatSource === 'cli' ? (opts.format as string) : (config.format ?? (opts.format as string));

  const sortSource = program.getOptionValueSource('sort');
  const sort =
    sortSource === 'cli' ? (opts.sort as string) : (config.sort ?? (opts.sort as string));

  const limitSource = program.getOptionValueSource('limit');
  const limit =
    limitSource === 'cli'
      ? (opts.limit as number | undefined)
      : (config.limit ?? (opts.limit as number | undefined));

  return {
    options: analyzeOptions,
    format,
    renderOptions: {
      sort: { by: sort as SortableColumn, order: 'desc' as const },
      ...(limit !== undefined && !isNaN(limit) ? { limit } : {}),
    },
    recursive,
    splitSubmodules,
  };
};
