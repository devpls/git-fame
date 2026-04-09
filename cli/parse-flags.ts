import { parseArgs } from 'node:util';
import type { AnalyzeOptions } from '../src/types/analyze-options.type.js';
import type { RenderOptions, SortableColumn } from '../src/render/index.js';
import { loadConfig } from '../src/internal/config/load-config.js';
import { HELP_TEXT } from './help.js';

export interface ParsedFlags {
  options: AnalyzeOptions;
  format: string;
  renderOptions: RenderOptions;
  recursive: boolean;
  splitSubmodules: boolean;
  perAuthor: boolean;
}

export const parseFlags = (argv: string[]): ParsedFlags => {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'V' },
      format: { type: 'string' },
      sort: { type: 'string' },
      limit: { type: 'string' },
      rev: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      since: { type: 'string' },
      until: { type: 'string' },
      'include-whitespace': { type: 'boolean' },
      'include-binary': { type: 'boolean' },
      'include-generated': { type: 'boolean' },
      'exclude-minified': { type: 'boolean' },
      'no-follow-renames': { type: 'boolean' },
      'no-mailmap': { type: 'boolean' },
      'include-globs': { type: 'string' },
      'exclude-globs': { type: 'string' },
      concurrency: { type: 'string' },
      'no-cache': { type: 'boolean' },
      bytype: { type: 'boolean' },
      bydir: { type: 'string' },
      'per-author': { type: 'boolean' },
      submodules: { type: 'boolean' },
      'split-submodules': { type: 'boolean' },
      recursive: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help === true) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  if (values.version === true) {
    process.stdout.write('0.1.0\n');
    process.exit(0);
  }

  const path = positionals[0] ?? process.cwd();
  const config = loadConfig(path);

  // Comma-split globs
  const cliIncludeGlobs =
    values['include-globs'] !== undefined ? values['include-globs'].split(',') : undefined;
  const cliExcludeGlobs =
    values['exclude-globs'] !== undefined ? values['exclude-globs'].split(',') : undefined;

  const include: AnalyzeOptions['include'] = {
    whitespace: values['include-whitespace'] ?? config.includeWhitespace ?? false,
    binary: values['include-binary'] ?? config.includeBinary ?? false,
    generated: values['include-generated'] ?? config.includeGenerated ?? false,
  };
  if (values['exclude-minified'] === true || config.excludeMinified === true) {
    include.minified = false;
  }

  const analyzeOptions: AnalyzeOptions = {
    path,
    include,
    options: {
      followRenames: values['no-follow-renames'] === true ? false : (config.followRenames ?? true),
      applyMailmap: values['no-mailmap'] === true ? false : (config.mailmap ?? true),
    },
  };

  if (cliIncludeGlobs !== undefined) {
    analyzeOptions.includeGlobs = cliIncludeGlobs;
  } else if (config.includeGlobs !== undefined) {
    analyzeOptions.includeGlobs = config.includeGlobs;
  }

  if (cliExcludeGlobs !== undefined) {
    analyzeOptions.excludeGlobs = cliExcludeGlobs;
  } else if (config.excludeGlobs !== undefined) {
    analyzeOptions.excludeGlobs = config.excludeGlobs;
  }

  if (values.rev !== undefined) {
    analyzeOptions.rev = values.rev;
  } else if (config.rev !== undefined) {
    analyzeOptions.rev = config.rev;
  }

  if (values.from !== undefined && values.to !== undefined) {
    analyzeOptions.range = { from: values.from, to: values.to };
  } else if (config.from !== undefined && config.to !== undefined) {
    analyzeOptions.range = { from: config.from, to: config.to };
  }

  if (values.since !== undefined) {
    analyzeOptions.since = new Date(values.since);
  } else if (config.since !== undefined) {
    analyzeOptions.since = new Date(config.since);
  }

  if (values.until !== undefined) {
    analyzeOptions.until = new Date(values.until);
  } else if (config.until !== undefined) {
    analyzeOptions.until = new Date(config.until);
  }

  const cliConcurrency =
    values.concurrency !== undefined ? parseInt(values.concurrency, 10) : undefined;
  if (cliConcurrency !== undefined && !isNaN(cliConcurrency)) {
    analyzeOptions.concurrency = cliConcurrency;
  } else if (config.concurrency !== undefined) {
    analyzeOptions.concurrency = config.concurrency;
  }

  analyzeOptions.cache = values['no-cache'] === true ? false : (config.cache ?? true);

  const submodules = values.submodules ?? config.submodules ?? false;
  const splitSubmodules = values['split-submodules'] ?? config.splitSubmodules ?? false;
  const recursive = values.recursive ?? config.recursive ?? false;

  if (submodules || splitSubmodules) {
    analyzeOptions.submodules = true;
  }

  // Breakdown: --bytype / --bydir
  if (values.bytype === true && values.bydir !== undefined) {
    process.stderr.write('node-fame: --bytype and --bydir are mutually exclusive\n');
    process.exit(1);
  }
  if (values.bytype === true) {
    analyzeOptions.groupBy = { type: 'extension', depth: 0 };
  } else if (values.bydir !== undefined) {
    const depth = parseInt(values.bydir, 10);
    if (isNaN(depth) || depth < 1) {
      process.stderr.write('node-fame: --bydir requires a positive integer depth\n');
      process.exit(1);
    }
    analyzeOptions.groupBy = { type: 'directory', depth };
  }

  const format = values.format ?? config.format ?? 'table';
  const sort = values.sort ?? config.sort ?? 'linesAlive';
  const cliLimit = values.limit !== undefined ? parseInt(values.limit, 10) : undefined;
  const limit = cliLimit ?? config.limit;

  return {
    options: analyzeOptions,
    format,
    renderOptions: {
      sort: { by: sort as SortableColumn, order: 'desc' as const },
      ...(limit !== undefined && !isNaN(limit) ? { limit } : {}),
    },
    recursive,
    splitSubmodules,
    perAuthor: values['per-author'] ?? false,
  };
};
