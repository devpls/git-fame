# --bytype / --bydir + parseArgs Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Commander with `node:util.parseArgs`, add `--bytype` and `--bydir` breakdown flags with standalone and per-author modes.

**Architecture:** Task 1 migrates CLI parsing to parseArgs (zero-dep, simpler config merge). Tasks 2-5 add breakdown: group key utility, aggregator changes, rendering, CLI wiring. Each task produces working software independently.

**Tech Stack:** TypeScript 6, `node:util.parseArgs`, vitest 4, cli-table3.

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By.

---

## File structure

### New files

| Path                                                  | Responsibility                                       |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `cli/help.ts`                                         | `--help` text template                               |
| `src/internal/pipeline/compute-group-key.ts`          | Extract extension or directory prefix from file path |
| `src/internal/pipeline/compute-group-key.test.ts`     | Tests                                                |
| `src/types/breakdown-entry.type.ts`                   | `BreakdownEntry` interface                           |
| `src/render/breakdown/render-breakdown-table.ts`      | Standalone breakdown table renderer                  |
| `src/render/breakdown/render-breakdown-table.test.ts` | Tests                                                |
| `src/render/breakdown/render-breakdown-json.ts`       | JSON breakdown                                       |
| `src/render/breakdown/render-breakdown-csv.ts`        | CSV breakdown                                        |
| `src/render/breakdown/render-breakdown-markdown.ts`   | Markdown breakdown                                   |
| `src/render/breakdown/index.ts`                       | Barrel                                               |

### Modified files

| Path                                             | What changes                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `cli/parse-flags.ts`                             | Full rewrite: parseArgs, comma-split globs, --bytype/--bydir/--per-author |
| `cli/parse-flags.test.ts`                        | Update all tests for new parsing                                          |
| `cli/bin.ts`                                     | Remove Commander import, handle breakdown output mode                     |
| `package.json`                                   | Remove `commander` from dependencies                                      |
| `src/types/analyze-options.type.ts`              | Add `groupBy`                                                             |
| `src/types/report.type.ts`                       | Add optional `breakdown` field                                            |
| `src/types/author-stats.type.ts`                 | Add optional `breakdown` field                                            |
| `src/internal/identity/aggregator/aggregator.ts` | Add `recordBlameGroup`, `recordFileGroup`                                 |
| `src/internal/pipeline/blame-worker.ts`          | Call `recordBlameGroup`/`recordFileGroup` when groupBy set                |
| `src/internal/pipeline/run-blame-phase.ts`       | Pass groupBy to workers                                                   |
| `src/internal/pipeline/assemble-report.ts`       | Populate breakdown fields                                                 |
| `src/analyze.ts`                                 | Pass groupBy through                                                      |
| `src/render/render.ts`                           | Dispatch to breakdown renderers when applicable                           |
| `src/index.ts`                                   | Export `BreakdownEntry` type                                              |

---

## Task 1: Migrate CLI from Commander to parseArgs

Full rewrite of `cli/parse-flags.ts` and `cli/bin.ts`. Remove `commander` dependency. All existing tests must pass after migration.

**Files:**

- Create: `cli/help.ts`
- Modify: `cli/parse-flags.ts` (full rewrite)
- Modify: `cli/parse-flags.test.ts` (update for new parsing behavior)
- Modify: `cli/bin.ts` (remove Commander imports)
- Modify: `package.json` (remove commander)

- [ ] **Step 1: Create help text**

Create `cli/help.ts`:

```ts
export const HELP_TEXT = `Usage: node-fame [options] [path]

Fast, accurate git contribution stats — lines, commits, files per author.

Arguments:
  path                           Repository path (default: current directory)

Options:
  -V, --version                  Output the version number
  --format <format>              Output format: table, json, csv, markdown (default: table)
  --sort <column>                Sort by: linesAlive, linesAdded, linesDeleted, commits, files (default: linesAlive)
  --limit <n>                    Show only top N authors
  --rev <ref>                    Analyze at a specific commit, tag, or branch
  --from <ref>                   Start of commit range (used with --to)
  --to <ref>                     End of commit range (used with --from)
  --since <date>                 Only count log entries after this date
  --until <date>                 Only count log entries before this date
  --include-whitespace           Count whitespace-only changes
  --include-binary               Include binary files
  --include-generated            Include generated/vendored files
  --exclude-minified             Exclude minified files
  --no-follow-renames            Do not follow renames in blame
  --no-mailmap                   Do not apply .mailmap
  --include-globs <a,b,c>        Only analyze matching files (comma-separated)
  --exclude-globs <a,b,c>        Exclude matching files (comma-separated)
  --concurrency <n>              Parallel blame workers (default: auto)
  --no-cache                     Disable result caching
  --bytype                       Group results by file extension
  --bydir <depth>                Group results by directory at given depth
  --per-author                   Show breakdown per author (with --bytype or --bydir)
  --submodules                   Walk into submodules
  --split-submodules             Separate reports per submodule
  --recursive                    Analyze all repos in subdirectories
  -h, --help                     Display help
`;
```

- [ ] **Step 2: Rewrite parse-flags.ts with parseArgs**

Read current `cli/parse-flags.ts`. Replace entirely with:

```ts
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
```

Key changes from Commander version:

- `undefined` means "not passed" for ALL options (no `getOptionValueSource` needed)
- `--no-follow-renames` is an explicit boolean flag, not Commander's `--no-` magic
- `--no-cache` same pattern
- `--include-globs` accepts comma-separated string, split in parser
- `--bytype`, `--bydir`, `--per-author` are new
- `perAuthor` added to `ParsedFlags` return type
- No `exitOverride` — `process.exit` for help/version/errors

- [ ] **Step 3: Update parse-flags.test.ts**

The test needs updates:

- `--include-globs '*.ts' '*.tsx'` (variadic) → `--include-globs '*.ts,*.tsx'` (comma-separated)
- `--exclude-globs 'vendor/**'` stays the same (single value)
- Remove any test relying on Commander-specific behavior
- Add tests for `--bytype`, `--bydir`, `--per-author`

Read the existing test file. Update:

1. Change line 42-43: `--include-globs '*.ts' '*.tsx'` → `--include-globs '*.ts,*.tsx'`
2. Add bytype/bydir/per-author tests
3. Keep all other tests — they should work as-is with parseArgs

Append to the describe block:

```ts
it('sets bytype groupBy', () => {
  const { options } = parseFlags([...base, '--bytype']);
  expect(options.groupBy).toEqual({ type: 'extension', depth: 0 });
});

it('sets bydir groupBy with depth', () => {
  const { options } = parseFlags([...base, '--bydir', '2']);
  expect(options.groupBy).toEqual({ type: 'directory', depth: 2 });
});

it('sets perAuthor flag', () => {
  const { perAuthor } = parseFlags([...base, '--bytype', '--per-author']);
  expect(perAuthor).toBe(true);
});

it('accepts comma-separated include-globs', () => {
  const { options } = parseFlags([...base, '--include-globs', '*.ts,*.tsx']);
  expect(options.includeGlobs).toEqual(['*.ts', '*.tsx']);
});
```

- [ ] **Step 4: Update bin.ts — remove Commander**

In `cli/bin.ts`:

- Remove `import { CommanderError } from 'commander';`
- In the `.catch()` handler, remove the `CommanderError` check:

```ts
main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
```

- [ ] **Step 5: Remove commander from package.json**

```bash
npm uninstall commander
```

This removes it from `dependencies` and `package-lock.json`.

- [ ] **Step 6: Add `groupBy` to AnalyzeOptions**

In `src/types/analyze-options.type.ts`, add:

```ts
  groupBy?: {
    type: 'extension' | 'directory';
    depth: number;
  };
```

- [ ] **Step 7: Run lint + tests**

```bash
npm run lint && npm run test:run
```

All tests must pass. Fix any issues.

- [ ] **Step 8: Commit**

```bash
git add cli/ package.json package-lock.json src/types/analyze-options.type.ts
git commit -m "Replace Commander with node:util.parseArgs and add breakdown CLI flags"
```

---

## Task 2: computeGroupKey + Aggregator breakdown

Add group key computation utility and breakdown tracking in the Aggregator.

**Files:**

- Create: `src/internal/pipeline/compute-group-key.ts`
- Create: `src/internal/pipeline/compute-group-key.test.ts`
- Create: `src/types/breakdown-entry.type.ts`
- Modify: `src/types/report.type.ts`
- Modify: `src/types/author-stats.type.ts`
- Modify: `src/internal/identity/aggregator/aggregator.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create computeGroupKey tests**

Create `src/internal/pipeline/compute-group-key.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeGroupKey } from './compute-group-key.js';

describe('computeGroupKey', () => {
  it('extracts file extension', () => {
    expect(computeGroupKey('src/app.ts', { type: 'extension', depth: 0 })).toBe('.ts');
  });

  it('returns (no ext) for extensionless files', () => {
    expect(computeGroupKey('Makefile', { type: 'extension', depth: 0 })).toBe('(no ext)');
  });

  it('extracts top-level directory at depth 1', () => {
    expect(computeGroupKey('src/internal/git/spawn.ts', { type: 'directory', depth: 1 })).toBe(
      'src',
    );
  });

  it('extracts two levels at depth 2', () => {
    expect(computeGroupKey('src/internal/git/spawn.ts', { type: 'directory', depth: 2 })).toBe(
      'src/internal',
    );
  });

  it('returns (root) for root-level files', () => {
    expect(computeGroupKey('README.md', { type: 'directory', depth: 1 })).toBe('(root)');
  });

  it('returns full dir when depth exceeds path segments', () => {
    expect(computeGroupKey('src/app.ts', { type: 'directory', depth: 5 })).toBe('src');
  });
});
```

- [ ] **Step 2: Implement computeGroupKey**

Create `src/internal/pipeline/compute-group-key.ts`:

```ts
import { extname } from 'node:path';

interface GroupByConfig {
  type: 'extension' | 'directory';
  depth: number;
}

export const computeGroupKey = (filePath: string, groupBy: GroupByConfig): string => {
  if (groupBy.type === 'extension') {
    const ext = extname(filePath);
    return ext === '' ? '(no ext)' : ext;
  }

  const segments = filePath.split('/');
  if (segments.length <= 1) {
    return '(root)';
  }

  const dirSegments = segments.slice(0, -1);
  const taken = dirSegments.slice(0, groupBy.depth);
  return taken.length === 0 ? '(root)' : taken.join('/');
};
```

- [ ] **Step 3: Run computeGroupKey tests**

```bash
npx vitest run src/internal/pipeline/compute-group-key.test.ts
```

- [ ] **Step 4: Create BreakdownEntry type**

Create `src/types/breakdown-entry.type.ts`:

```ts
export interface BreakdownEntry {
  group: string;
  linesAlive: number;
  files: number;
}
```

- [ ] **Step 5: Update Report and AuthorStats types**

In `src/types/report.type.ts`, add import and field:

```ts
import type { BreakdownEntry } from './breakdown-entry.type.js';
```

Add to Report after `warnings`:

```ts
  breakdown?: BreakdownEntry[];
```

In `src/types/author-stats.type.ts`, add:

```ts
  breakdown?: Record<string, number>;
```

- [ ] **Step 6: Add breakdown methods to Aggregator**

In `src/internal/identity/aggregator/aggregator.ts`, add two new Maps after existing `private readonly warnings`:

```ts
  private readonly authorBreakdown = new Map<string, Map<string, number>>();
  private readonly groupTotals = new Map<string, { linesAlive: number; files: Set<string> }>();
```

Add two new methods after `recordBlameAuthor`:

```ts
  recordBlameGroup(name: string, mail: string, groupKey: string): void {
    const canonical = this.mailmap.canonicalize(name, mail);
    const authorMap = this.authorBreakdown.get(canonical.email) ?? new Map<string, number>();
    authorMap.set(groupKey, (authorMap.get(groupKey) ?? 0) + 1);
    this.authorBreakdown.set(canonical.email, authorMap);
  }

  recordFileGroup(groupKey: string, filePath: string): void {
    const existing = this.groupTotals.get(groupKey);
    if (existing !== undefined) {
      existing.files.add(filePath);
    } else {
      this.groupTotals.set(groupKey, { linesAlive: 0, files: new Set([filePath]) });
    }
  }
```

Update `recordBlameGroup` to also increment linesAlive on groupTotals:

Actually, simpler: increment groupTotals.linesAlive inside `recordBlameGroup`:

```ts
  recordBlameGroup(name: string, mail: string, groupKey: string): void {
    const canonical = this.mailmap.canonicalize(name, mail);
    const authorMap = this.authorBreakdown.get(canonical.email) ?? new Map<string, number>();
    authorMap.set(groupKey, (authorMap.get(groupKey) ?? 0) + 1);
    this.authorBreakdown.set(canonical.email, authorMap);

    const totals = this.groupTotals.get(groupKey);
    if (totals !== undefined) {
      totals.linesAlive += 1;
    } else {
      this.groupTotals.set(groupKey, { linesAlive: 1, files: new Set<string>() });
    }
  }
```

Add test-only accessors:

```ts
  getAuthorBreakdownForTesting(): ReadonlyMap<string, Map<string, number>> {
    return this.authorBreakdown;
  }

  getGroupTotalsForTesting(): ReadonlyMap<string, { linesAlive: number; files: Set<string> }> {
    return this.groupTotals;
  }
```

Update the `build` method signature to accept a `hasBreakdown` flag and populate the new fields. In the `build` method, after creating `authors` array, add:

```ts
  build(meta: Report['meta'], repoBase: Report['repo']): Report {
    const authors = Array.from(this.authors.values()).map((stats) => {
      const author = finaliseAuthor(stats);
      const bd = this.authorBreakdown.get(stats.email);
      if (bd !== undefined && bd.size > 0) {
        author.breakdown = Object.fromEntries(bd);
      }
      return author;
    });

    // ... existing totals code ...

    const breakdown = this.groupTotals.size > 0
      ? Array.from(this.groupTotals.entries())
          .map(([group, data]) => ({ group, linesAlive: data.linesAlive, files: data.files.size }))
          .sort((a, b) => b.linesAlive - a.linesAlive)
      : undefined;

    return {
      meta,
      repo: { ...repoBase, totals },
      authors,
      warnings: this.warnings.slice(),
      breakdown,
    };
  }
```

Note: `finaliseAuthor` needs to handle the optional `breakdown`. The simplest: assign it after calling `finaliseAuthor` (which returns `AuthorStats` without breakdown), then set `breakdown` on it.

- [ ] **Step 7: Export BreakdownEntry from index.ts**

In `src/index.ts`, add:

```ts
export type { BreakdownEntry } from './types/breakdown-entry.type.js';
```

- [ ] **Step 8: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 9: Commit**

```bash
git add src/internal/pipeline/compute-group-key.ts src/internal/pipeline/compute-group-key.test.ts src/types/ src/internal/identity/aggregator/aggregator.ts src/index.ts
git commit -m "Add group key computation and breakdown tracking in Aggregator"
```

---

## Task 3: Wire breakdown into blame pipeline

Pass `groupBy` through analyze → blame phase → worker. Call `recordBlameGroup` and `recordFileGroup` from the worker.

**Files:**

- Modify: `src/analyze.ts`
- Modify: `src/internal/pipeline/run-blame-phase.ts`
- Modify: `src/internal/pipeline/blame-worker.ts`

- [ ] **Step 1: Update run-blame-phase to accept groupBy**

Add `groupBy` as optional parameter to `runBlamePhase` and `createBlameWorker`.

In `run-blame-phase.ts`, update the function signature:

```ts
export const runBlamePhase = async (
  cwd: string,
  files: readonly string[],
  aggregator: Aggregator,
  options: BlameOptions,
  onProgress?: (event: ProgressEvent) => void,
  concurrency?: number,
  groupBy?: { type: 'extension' | 'directory'; depth: number },
): Promise<void> => {
```

Pass `groupBy` when creating workers:

```ts
const workers = Array.from({ length: workerCount }, () =>
  createBlameWorker(cwd, aggregator, options, groupBy),
);
```

- [ ] **Step 2: Update blame-worker to record group data**

In `blame-worker.ts`, add import:

```ts
import { computeGroupKey } from './compute-group-key.js';
```

Update `createBlameWorker` to accept `groupBy`:

```ts
export const createBlameWorker = (
  cwd: string,
  aggregator: Aggregator,
  options: BlameWorkerOptions,
  groupBy?: { type: 'extension' | 'directory'; depth: number },
): BlameWorker => {
```

After `countBlameLines(blameOutput, aggregator);` succeeds, if `groupBy` is set, call `recordBlameGroup` for each line. But wait — `countBlameLines` already counts lines. We need the group key per line.

Better approach: modify the blame callback. Instead of just counting, when groupBy is set, the blame-worker needs to know how many lines were attributed to each author for this file, and call `recordBlameGroup` for each.

Simplest: after `countBlameLines`, we know it incremented `linesAlive` for various authors. But we don't know which authors or how many lines per author — that info is lost inside `countBlameLines`.

The fix: add a `groupKey` parameter to `countBlameLines`. When set, it calls `aggregator.recordBlameGroup(name, mail, groupKey)` alongside `recordBlameAuthor(name, mail)`.

In `src/internal/pipeline/count-blame-lines.ts`, update the function:

```ts
export const countBlameLines = (
  output: string,
  aggregator: Aggregator,
  groupKey?: string,
): void => {
```

And where it calls `aggregator.recordBlameAuthor(currentName, currentMail);`, add:

```ts
if (line.startsWith('\t')) {
  aggregator.recordBlameAuthor(currentName, currentMail);
  if (groupKey !== undefined) {
    aggregator.recordBlameGroup(currentName, currentMail, groupKey);
  }
  // ... rest of caching logic
}
```

Back in `blame-worker.ts`, compute the group key and pass it:

```ts
if (blameOutput.length === 0) {
  // ... warning ...
} else {
  try {
    const gk = groupBy !== undefined ? computeGroupKey(currentFile, groupBy) : undefined;
    countBlameLines(blameOutput, aggregator, gk);
    if (groupBy !== undefined && gk !== undefined) {
      aggregator.recordFileGroup(gk, currentFile);
    }
  } catch {
    // ... warning ...
  }
}
```

- [ ] **Step 3: Pass groupBy from analyze.ts**

In `src/analyze.ts`, pass `options.groupBy` to `runBlamePhase`:

Change:

```ts
    runBlamePhase(
      options.path,
      discovered.files,
      aggregator,
      { rev: discovered.headSha, followRenames, ignoreWhitespace },
      options.onProgress,
      options.concurrency,
    ),
```

to:

```ts
    runBlamePhase(
      options.path,
      discovered.files,
      aggregator,
      { rev: discovered.headSha, followRenames, ignoreWhitespace },
      options.onProgress,
      options.concurrency,
      options.groupBy,
    ),
```

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze.ts src/internal/pipeline/run-blame-phase.ts src/internal/pipeline/blame-worker.ts src/internal/pipeline/count-blame-lines.ts
git commit -m "Wire groupBy through blame pipeline for breakdown tracking"
```

---

## Task 4: Breakdown renderers

Render standalone breakdown table and per-author breakdown column for all 4 formats.

**Files:**

- Create: `src/render/breakdown/render-breakdown-table.ts`
- Create: `src/render/breakdown/render-breakdown-table.test.ts`
- Create: `src/render/breakdown/render-breakdown-json.ts`
- Create: `src/render/breakdown/render-breakdown-csv.ts`
- Create: `src/render/breakdown/render-breakdown-markdown.ts`
- Create: `src/render/breakdown/index.ts`
- Modify: `src/render/render.ts`

- [ ] **Step 1: Create table breakdown renderer + test**

Create `src/render/breakdown/render-breakdown-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderBreakdownTable } from './render-breakdown-table.js';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

describe('renderBreakdownTable', () => {
  it('renders breakdown entries as a table', () => {
    const entries: BreakdownEntry[] = [
      { group: '.ts', linesAlive: 5000, files: 120 },
      { group: '.css', linesAlive: 200, files: 15 },
    ];
    const output = renderBreakdownTable(entries);
    expect(output).toContain('.ts');
    expect(output).toContain('5000');
    expect(output).toContain('.css');
  });
});
```

Create `src/render/breakdown/render-breakdown-table.ts`:

```ts
import Table from 'cli-table3';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownTable = (entries: BreakdownEntry[]): string => {
  const table = new Table({
    head: ['group', 'linesAlive', 'files'],
  });

  for (const entry of entries) {
    table.push([entry.group, String(entry.linesAlive), String(entry.files)]);
  }

  return table.toString();
};
```

- [ ] **Step 2: Create JSON/CSV/Markdown breakdown renderers**

Create `src/render/breakdown/render-breakdown-json.ts`:

```ts
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownJson = (entries: BreakdownEntry[]): string =>
  JSON.stringify({ breakdown: entries }, null, 2);
```

Create `src/render/breakdown/render-breakdown-csv.ts`:

```ts
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownCsv = (entries: BreakdownEntry[]): string => {
  const header = 'group,linesAlive,files';
  const rows = entries.map((e) => `${e.group},${String(e.linesAlive)},${String(e.files)}`);
  return [header, ...rows].join('\n');
};
```

Create `src/render/breakdown/render-breakdown-markdown.ts`:

```ts
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownMarkdown = (entries: BreakdownEntry[]): string => {
  const header = '| group | linesAlive | files |';
  const separator = '| --- | --- | --- |';
  const rows = entries.map((e) => `| ${e.group} | ${String(e.linesAlive)} | ${String(e.files)} |`);
  return [header, separator, ...rows].join('\n');
};
```

Create barrel `src/render/breakdown/index.ts`:

```ts
export { renderBreakdownTable } from './render-breakdown-table.js';
export { renderBreakdownJson } from './render-breakdown-json.js';
export { renderBreakdownCsv } from './render-breakdown-csv.js';
export { renderBreakdownMarkdown } from './render-breakdown-markdown.js';
```

- [ ] **Step 3: Update render.ts to dispatch breakdown**

In `src/render/render.ts`, add import:

```ts
import {
  renderBreakdownTable,
  renderBreakdownJson,
  renderBreakdownCsv,
  renderBreakdownMarkdown,
} from './breakdown/index.js';
```

Add a new exported function for breakdown rendering:

```ts
export const renderBreakdown = (report: Report, format: RenderFormat): string | undefined => {
  if (report.breakdown === undefined || report.breakdown.length === 0) {
    return undefined;
  }
  const f: string = format;
  if (f === 'table') return renderBreakdownTable(report.breakdown);
  if (f === 'json') return renderBreakdownJson(report.breakdown);
  if (f === 'csv') return renderBreakdownCsv(report.breakdown);
  if (f === 'markdown') return renderBreakdownMarkdown(report.breakdown);
  return undefined;
};
```

- [ ] **Step 4: Update bin.ts to handle breakdown output**

In `cli/bin.ts`, import `renderBreakdown`:

```ts
import { render, renderBreakdown } from '../src/render/index.js';
```

After the existing `render(report, ...)` call for the single-repo case, add breakdown output:

```ts
const report = await analyze(options);
const output = render(report, format as RenderFormat, renderOptions);
process.stdout.write(output + '\n');

if (perAuthor === false) {
  const breakdownOutput = renderBreakdown(report, format as RenderFormat);
  if (breakdownOutput !== undefined) {
    process.stdout.write('\n' + breakdownOutput + '\n');
  }
}
```

Wait — we need `perAuthor` in bin.ts. Update the destructuring:

```ts
const { options, format, renderOptions, recursive, splitSubmodules, perAuthor } = parseFlags(
  process.argv,
);
```

The per-author mode: when `--per-author` is set, the normal author table already includes `author.breakdown` — the existing renderers need to show it. For v1, the per-author breakdown is shown as the `breakdown` field in JSON output. For table/csv/markdown, add a `breakdown` column.

Actually, this is getting complex. For per-author mode, the existing author renderers need to add a column. Let's handle that in a follow-up or keep it simple: JSON already includes `author.breakdown` naturally. For table, add a compact breakdown column.

For this task: standalone breakdown mode only. Per-author column is a cosmetic enhancement that can come later.

- [ ] **Step 5: Export renderBreakdown from render barrel**

In `src/render/index.ts`, add:

```ts
export { renderBreakdown } from './render.js';
```

- [ ] **Step 6: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 7: Commit**

```bash
git add src/render/breakdown/ src/render/render.ts src/render/index.ts cli/bin.ts
git commit -m "Add breakdown renderers for all output formats"
```

---

## Task 5: Integration test + build + verify

End-to-end test on a real repo.

**Files:**

- Modify: `src/analyze.test.ts`

- [ ] **Step 1: Add breakdown integration test**

Append to `src/analyze.test.ts`:

```ts
it('populates breakdown when groupBy extension is set', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <a@x>',
      date: '2024-01-01T00:00:00Z',
      files: { 'a.ts': 'line\n', 'b.css': 'style\n' },
    },
  ]);
  createdRepos.push(dir);

  const report = await analyze({ path: dir, groupBy: { type: 'extension', depth: 0 } });
  expect(report.breakdown).toBeDefined();
  expect(report.breakdown!.length).toBeGreaterThanOrEqual(2);

  const tsEntry = report.breakdown!.find((e) => e.group === '.ts');
  expect(tsEntry?.linesAlive).toBe(1);
  expect(tsEntry?.files).toBe(1);
});

it('populates breakdown when groupBy directory depth 1 is set', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <a@x>',
      date: '2024-01-01T00:00:00Z',
      files: { 'src/a.ts': 'line\n', 'cli/b.ts': 'line\n', 'root.txt': 'line\n' },
    },
  ]);
  createdRepos.push(dir);

  const report = await analyze({ path: dir, groupBy: { type: 'directory', depth: 1 } });
  expect(report.breakdown).toBeDefined();

  const srcEntry = report.breakdown!.find((e) => e.group === 'src');
  const cliEntry = report.breakdown!.find((e) => e.group === 'cli');
  const rootEntry = report.breakdown!.find((e) => e.group === '(root)');
  expect(srcEntry?.linesAlive).toBe(1);
  expect(cliEntry?.linesAlive).toBe(1);
  expect(rootEntry?.linesAlive).toBe(1);
});
```

- [ ] **Step 2: Run all tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 3: Build + manual test**

```bash
npm run build
node dist/cli/bin.js --bytype .
node dist/cli/bin.js --bydir 1 .
```

- [ ] **Step 4: Commit**

```bash
git add src/analyze.test.ts
git commit -m "Add breakdown integration tests"
```
