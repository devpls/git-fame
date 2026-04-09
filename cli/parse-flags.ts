import { Command } from 'commander';
import type { AnalyzeOptions } from '../src/types/analyze-options.type.js';

export interface ParsedFlags {
  options: AnalyzeOptions;
  format: string;
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
    .option('--rev <ref>', 'Analyze at a specific commit, tag, or branch')
    .option('--from <ref>', 'Start of commit range (used with --to)')
    .option('--to <ref>', 'End of commit range (used with --from)')
    .option('--since <date>', 'Only count log entries after this date (ISO 8601)')
    .option('--until <date>', 'Only count log entries before this date (ISO 8601)')
    .exitOverride()
    .parse(argv);

  const opts = program.opts();
  const path = program.args[0] ?? process.cwd();

  const include: AnalyzeOptions['include'] = {
    whitespace: (opts.includeWhitespace as boolean | undefined) ?? false,
    binary: (opts.includeBinary as boolean | undefined) ?? false,
    generated: (opts.includeGenerated as boolean | undefined) ?? false,
  };
  if ((opts.excludeMinified as boolean | undefined) === true) {
    include.minified = false;
  }

  const analyzeOptions: AnalyzeOptions = {
    path,
    include,
    options: {
      followRenames: opts.followRenames as boolean,
      applyMailmap: opts.mailmap as boolean,
    },
  };
  if ((opts.includeGlobs as string[] | undefined) !== undefined) {
    analyzeOptions.includeGlobs = opts.includeGlobs as string[];
  }
  if ((opts.excludeGlobs as string[] | undefined) !== undefined) {
    analyzeOptions.excludeGlobs = opts.excludeGlobs as string[];
  }
  if ((opts.rev as string | undefined) !== undefined) {
    analyzeOptions.rev = opts.rev as string;
  }
  if (
    (opts.from as string | undefined) !== undefined &&
    (opts.to as string | undefined) !== undefined
  ) {
    analyzeOptions.range = { from: opts.from as string, to: opts.to as string };
  }
  if ((opts.since as string | undefined) !== undefined) {
    analyzeOptions.since = new Date(opts.since as string);
  }
  if ((opts.until as string | undefined) !== undefined) {
    analyzeOptions.until = new Date(opts.until as string);
  }

  return {
    options: analyzeOptions,
    format: opts.format as string,
  };
};
