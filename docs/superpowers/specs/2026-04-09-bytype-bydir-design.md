# --bytype / --bydir Breakdown — Design Spec

**Date:** 2026-04-10
**Status:** Approved for implementation

---

## Goal

Add `--bytype` and `--bydir` flags that break down contribution stats by
file extension or directory. Two output modes: standalone breakdown table
(per-type/per-dir) and per-author breakdown column. Also replace Commander
with `node:util.parseArgs` to eliminate variadic flag bugs and simplify
config merging.

## CLI Flags

- `--bytype` — group by file extension (`.ts`, `.css`, etc.)
- `--bydir <depth>` — group by directory at given depth. `--bydir 1` =
  top-level (`src`, `cli`). `--bydir 2` = two levels (`src/internal`).
- `--per-author` — modifier, only valid with `--bytype` or `--bydir`.
  Shows breakdown as a column in the per-author table instead of a
  standalone breakdown table.

Invalid: `--per-author` without `--bytype`/`--bydir` → ignored silently.
Invalid: `--bytype` and `--bydir` together → error
("--bytype and --bydir are mutually exclusive").

Note: `--bydir` takes a required numeric argument (not optional) to avoid
ambiguity with positional path argument. Users must write `--bydir 1`
for top-level grouping.

## Output modes

### Mode 1: Standalone breakdown table (default with --bytype/--bydir)

Rows = types or directories. Columns = linesAlive, files. No
linesAdded/linesDeleted (breakdown only tracks blame data, not log data).
Sorted by linesAlive descending.

```
$ node-fame --bytype .
┌──────┬────────────┬───────┐
│ type │ linesAlive │ files │
├──────┼────────────┼───────┤
│ .ts  │ 5000       │ 120   │
│ .css │ 200        │ 15    │
└──────┴────────────┴───────┘
```

### Mode 2: Per-author breakdown (--per-author)

Normal author table with an additional `breakdown` column showing top
entries as `ext:count` pairs.

```
$ node-fame --bytype --per-author .
┌───────┬────────────┬───────────────────┐
│ author│ linesAlive │ breakdown         │
├───────┼────────────┼───────────────────┤
│ Alice │ 5200       │ .ts:5000 .css:200 │
│ Bob   │ 300        │ .ts:250 .tsx:50   │
└───────┴────────────┴───────────────────┘
```

Breakdown column: sorted by count descending, top 5 entries, remaining
summed as `other:N` if more than 5 types.

## Type detection

File extension extracted via `path.extname(filePath)`. Files without
extension → `(no ext)`. Case-preserved (`.TS` stays `.TS`).

No language mapping or detection library. Pure extension.

## Directory grouping

`--bydir N`: take first N path segments of the relative path.

- depth=1: `src/internal/git/spawn-git.ts` → `src`
- depth=2: `src/internal/git/spawn-git.ts` → `src/internal`
- Files in root (no directory): `(root)`

## Aggregation changes

### Where grouping happens

The **blame-worker** determines `groupKey` from the file path it is
currently processing. It calls `aggregator.recordBlameGroup(name, mail,
groupKey)` after `aggregator.recordBlameAuthor(name, mail)` for each
blame line. The worker knows the file path; `countBlameLines` does not.

For per-file group tracking, the blame-worker calls
`aggregator.recordFileGroup(groupKey, file)` once per file (before blame
parsing begins).

### New data structures in Aggregator

Per-author breakdown (for `--per-author` mode):

```ts
private readonly authorBreakdown = new Map<string, Map<string, number>>();
// key: canonical email, value: Map<groupKey, linesAlive count>
```

New method:

```ts
recordBlameGroup(name: string, mail: string, groupKey: string): void
```

Standalone breakdown totals:

```ts
private readonly groupTotals = new Map<string, { linesAlive: number; files: Set<string> }>();
```

New method:

```ts
recordFileGroup(groupKey: string, filePath: string): void
```

### Group key computation

New utility (one file, used by blame-worker):

```ts
// src/internal/pipeline/compute-group-key.ts
const computeGroupKey = (
  filePath: string,
  groupBy: { type: 'extension' | 'directory'; depth: number },
): string => { ... }
```

## Report type changes

New type:

```ts
interface BreakdownEntry {
  group: string;
  linesAlive: number;
  files: number;
}
```

Add to `Report`:

```ts
breakdown?: BreakdownEntry[];
```

Add to `AuthorStats`:

```ts
breakdown?: Record<string, number>;
```

Both fields optional — only populated when `--bytype`/`--bydir` is used.

## AnalyzeOptions changes

```ts
groupBy?: {
  type: 'extension' | 'directory';
  depth: number;
};
```

## Commander → node:util.parseArgs migration

Replace `commander` with Node.js built-in `parseArgs` from `node:util`.

**Why:** Commander has recurring issues:

- Variadic options (`--include-globs <patterns...>`) eat the positional
  path argument
- `--no-X` flags default to `true`, making it impossible to distinguish
  "user didn't pass the flag" from "user wants the default" without
  `getOptionValueSource()`
- Each new flag adds complexity to the merge logic with `.node-famerc`

**parseArgs advantages:**

- Unset options are `undefined` (not a default value) — trivial config merge
- No variadic eating — `allowPositionals: true` keeps positionals separate
- `--no-X` is not magic — we handle negation explicitly
- Zero runtime dependency

**What changes:**

- `cli/parse-flags.ts` — full rewrite using `parseArgs`
- `cli/help.ts` — new file with `--help` text (parseArgs doesn't generate it)
- `package.json` — remove `commander` from dependencies
- Existing `parse-flags.test.ts` — update tests for new parsing behavior

**--help output:** hand-written template, ~30 lines. Printed when
`--help` is in argv, then `process.exit(0)`.

**--version:** check for `--version` in argv, print version, exit.

**Multi-value flags** (`--include-globs`, `--exclude-globs`): accept a
single comma-separated string. `--include-globs '*.ts,*.tsx,*.css'`.
Parsed via `value.split(',')`. One flag, one argument, no variadic issues.

## Data flow

1. CLI parses `--bytype`/`--bydir` → sets `groupBy` in AnalyzeOptions
2. `analyze()` passes `groupBy` to blame phase
3. Blame worker computes `groupKey` from file path using `computeGroupKey`
4. For each blame line: `aggregator.recordBlameAuthor(name, mail)` +
   `aggregator.recordBlameGroup(name, mail, groupKey)` (if groupBy set)
5. For each file: `aggregator.recordFileGroup(groupKey, file)` (if
   groupBy set)
6. `assembleReport` populates `report.breakdown` and
   `author.breakdown` from aggregator data (if groupBy set)
7. Renderers check `report.breakdown` — if present, render breakdown
   table or per-author breakdown column

## Rendering

All four renderers (table, json, csv, markdown) support both modes:

- **No --bytype/--bydir:** existing behavior unchanged
- **Standalone breakdown:** render BreakdownEntry[] as its own table
- **Per-author breakdown:** add `breakdown` column to author table

JSON renderer outputs breakdown as structured data. CSV/markdown render
it inline.

## Testing

- computeGroupKey: extension extraction, directory at depths 1-3, no ext,
  root files
- Aggregator: recordBlameGroup + recordFileGroup accumulate correctly
- Standalone breakdown: correct totals per type
- Per-author breakdown: correct per-author per-type counts
- Renderers: breakdown table and per-author column for all 4 formats
- CLI: --bytype, --bydir 1, --bydir 2, --per-author
- Error: --bytype + --bydir together → ConflictingOptionsError
- parseArgs migration: all existing CLI tests pass with new parser
- Config merge: .node-famerc still works with parseArgs

## Non-goals

- Language detection / linguist mapping
- Cross-tabulation (full author x type matrix)
- `--bydir` with glob patterns
- Breakdown in log phase (only blame linesAlive is broken down)
- linesAdded/linesDeleted in breakdown (would require per-file log tracking)
