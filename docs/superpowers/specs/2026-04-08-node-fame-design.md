# node-fame — Design Spec

**Date:** 2026-04-08
**Status:** Approved for implementation planning
**Author:** Mykhailo Kalashnikov (with Claude brainstorming session)

---

## Section 1 — Scope, Goals, Non-goals

### What this is

`node-fame` is an npm package (library + CLI) that analyses a git repository and
builds a contribution report per author: how many of their lines are alive in
HEAD, how many they added/deleted over history, how many commits and files they
touched. Inspired by `git-fame` (Python), rewritten from scratch for two
reasons: **correctness** (we do not lie in the numbers) and **speed** (streaming
+ parallelism instead of buffering).

### Guiding principles (non-negotiable)

1. **Quality over speed.** We do not cut corners in the algorithm for
   milliseconds. `git blame -M -C` is on by default. Both metrics
   (`linesAlive` from HEAD blame, and `linesAdded`/`linesDeleted` from
   `git log --numstat`) are always computed.
2. **Every default is overridable.** Any built-in filter can be flipped with a
   CLI flag of inverse meaning (`--no-mailmap`, `--include-merges`,
   `--include-whitespace`, `--no-follow-renames`, `--include-binary`,
   `--include-generated`, etc). No hard-wired filtering.
3. **Streaming, not buffering.** Any git stdout is read line-by-line via
   `readline`. No `exec` with full-command buffering. Nothing materialises a
   whole blame output before it is parsed.
4. **Library-first, CLI is a thin wrapper.** The core does not know about
   `commander`, `ora`, `cli-table3`, or any renderer. It only knows data and
   git. The CLI layer composes core + renderer + progress bar.
5. **Minimal runtime dependencies.** If `node:child_process` +
   `node:readline` can do it, we do not add a library for it. External
   dependencies only where they save meaningful complexity (argparse, glob
   matcher, progress bar, table renderer, concurrency limiter).

### Target scale

Repositories in the range of **10k–50k files, 500k–2M lines, 10k–100k
commits**. We work on bigger repositories but make no magic promises there.
Optimisation happens through architecture (spawn parallelism, porcelain
streaming, minimal allocations), not through dropping work.

### Submodules (in scope)

- **Default:** submodules are ignored entirely.
- **`--submodules` flag:** walks into submodules. For each submodule we check
  initialisation; uninitialised ones produce a `UNINIT_SUBMODULE` warning and
  are skipped. Initialised ones are analysed with the same pipeline. Results
  are merged into the parent report by default.
- **`--split-submodules` flag:** only applies when `--submodules` is set.
  Instead of merging, returns the parent report plus one separate report per
  submodule (via `analyzeMany`).
- Uninitialised submodules are **never** auto-initialised by the tool — we do
  not modify the user's repository state.

### Non-goals (explicitly NOT in v0.1.0)

- Worker threads / multi-process parsing. Deferred until profiling shows the
  single-threaded parser is the bottleneck.
- Per-language / per-directory breakdown (`--bytype`, `--bydir` in git-fame).
- GUI / web interface / HTML reports.
- Cross-run result cache keyed by commit SHA.
- Incremental update ("only recompute what changed since last run").
- Submodule recursion deeper than one level.
- Support for non-git VCS.

### Definition of "in scope" vs "out of scope"

The full future-work list lives in `ROADMAP.md` at the repository root,
created as part of M0. The design spec references it but does not duplicate
it — the roadmap file is the canonical place to look when planning post-v0.1
work.

---

## Section 2 — Public API

Two entry-point functions, unambiguous return types (no unions).

### `analyze(options)` → `Promise<Report>`

Analyses a single repository. Returns exactly one `Report`. If
`submodules: true` is set without `splitSubmodules`, submodule contributions
are merged into this single report.

### `analyzeMany(options)` → `Promise<Report[]>`

Returns an array of reports. Used when:
- `recursive: true` — walks subdirectories looking for sibling git repos.
- `submodules: true` + `splitSubmodules: true` — returns parent + one per submodule.
- Both — reports for every repo and every initialised submodule within each.

If neither `recursive` nor `splitSubmodules` is set, calling `analyzeMany`
returns a single-element array equivalent to `[await analyze(options)]`.

### `AnalyzeOptions`

```ts
type AnalyzeOptions = {
  // REQUIRED — absolute path to the repository root. No CWD default;
  // the CLI is responsible for providing the path explicitly.
  path: string;

  // Ref / range — mutually exclusive. Runtime throw if both are provided.
  rev?: string;                              // default 'HEAD'
  range?: { from: string; to: string };

  // Date filter applied on top of rev/range — affects `git log` only,
  // blame is always taken from the rev/range upper bound.
  since?: Date;
  until?: Date;

  // What data is kept (defaults = "clean picture", noise filtered out).
  include?: {
    whitespace?: boolean;                    // default false
    merges?: boolean;                        // default false
    binary?: boolean;                        // default false
    generated?: boolean;                     // default false
    minified?: boolean;                      // default true — not detected by default
  };

  // Algorithmic options.
  options?: {
    followRenames?: boolean;                 // default true  (blame -M -C)
    applyMailmap?: boolean;                  // default true
  };

  // User path filters (gitignore-style, powered by picomatch).
  includeGlobs?: string[];                   // default []
  excludeGlobs?: string[];                   // default []

  // Submodules. Only relevant when .gitmodules is present.
  submodules?: boolean;                      // default false

  // Execution.
  concurrency?: number;                      // default 0 → auto (os.cpus().length)
  onProgress?: (ev: ProgressEvent) => void;
  signal?: AbortSignal;                      // kills all active git children on abort
};
```

### `AnalyzeManyOptions`

```ts
type AnalyzeManyOptions = AnalyzeOptions & {
  recursive?: boolean;                       // walk subdirs for sibling repos
  splitSubmodules?: boolean;                 // requires submodules: true
};
```

### `Report`

```ts
type Report = {
  meta: {
    version: string;                         // node-fame version that produced this
    generatedAt: Date;
    durationMs: number;
  };

  repo: {
    path: string;                            // absolute
    headSha: string;                         // resolved SHA of the analysis upper bound
    headRef: string;                         // human-readable: 'HEAD' | 'v2.0' | 'main' | SHA
    range?: {                                // populated only when options.range was used
      fromSha: string;
      toSha: string;
      fromRef: string;
      toRef: string;
    };
    totals: {
      lines: number;                         // Σ linesAlive across all authors
      commits: number;
      files: number;
    };
  };

  // UNORDERED — sorting is a view concern, not a data contract.
  authors: AuthorStats[];

  // Structured, non-fatal events collected during analysis.
  warnings: Warning[];
};

type AuthorStats = {
  // Priority: (1) mailmap canonical name > (2) most-recent commit name.
  name: string;
  email: string;                             // post-mailmap canonical email

  linesAlive: number;                        // HEAD blame, whitespace handling per flags
  linesAdded: number;                        // Σ from git log --numstat
  linesDeleted: number;                      // Σ from git log --numstat
  commits: number;
  files: number;                             // distinct files the author touched

  firstCommit: Date;
  lastCommit: Date;

  // Derived fields (linesNet, percentAlive) are NOT stored here.
  // Renderers compute them at display time.
};

type Warning =
  | { code: 'UNINIT_SUBMODULE'; path: string; message: string }
  | { code: 'SUBMODULE_BROKEN'; path: string; message: string }
  | { code: 'BLAME_FAILED'; file: string; error: string; message: string }
  | { code: 'FILE_SKIPPED_BINARY'; file: string; message: string }
  | { code: 'FILE_SKIPPED_GENERATED'; file: string; message: string }
  | { code: 'FILE_SKIPPED_MINIFIED'; file: string; message: string }
  | { code: 'INVALID_UTF8'; file: string; message: string }
  | { code: 'LARGE_FILE'; file: string; bytes: number; message: string }
  | { code: 'MANY_LARGE_FILES'; count: number; message: string }
  | { code: 'MAILMAP_PARSE'; line: number; message: string }
  | { code: 'ALL_FILES_FILTERED'; message: string };
```

**Empty result is legitimate.** An empty repository, or one whose files are
all filtered out, produces `authors: []`, `totals: { lines: 0, commits: 0,
files: 0 }`. Never throws.

### Rendering — one entry point

```ts
type RenderFormat = 'table' | 'json' | 'csv' | 'markdown';

type Column =
  | 'author' | 'linesAlive' | 'linesAdded' | 'linesDeleted'
  | 'linesNet' | 'commits' | 'files' | 'percentAlive'
  | 'firstCommit' | 'lastCommit';

type RenderOptions = {
  sort?: {
    by: 'linesAlive' | 'linesAdded' | 'linesDeleted' | 'commits' | 'files' | 'lastCommit';
    order?: 'asc' | 'desc';                  // default 'desc'
  };
  limit?: number;                            // undefined = show all
  columns?: ReadonlyArray<Column>;           // override defaults
};

export function render(
  report: Report | Report[],
  format: RenderFormat,
  options?: RenderOptions,
): string;
```

Derived fields are computed at render time:
- `linesNet = linesAdded - linesDeleted`
- `percentAlive = linesAlive / repo.totals.lines * 100` (0 when divisor is 0)

Adding a new format is a new enum value + a new switch branch — no new public
exports, no semver bump to the API surface.

### Default columns (when `columns` is not overridden)

```
author, linesAlive, linesAdded, linesDeleted, commits, files, percentAlive
```

Seven columns. Default sort: `linesAlive` desc. These come from decisions in
the brainstorming session (question 6 — "option B", seven columns shown by
default).

### Errors

Typed error classes, all extending `NodeFameError`, exported from
`src/errors.ts`.

```ts
class NodeFameError extends Error { code: string }
class NotAGitRepoError       extends NodeFameError { path: string }
class GitNotInstalledError   extends NodeFameError { }
class InvalidRevError        extends NodeFameError { rev: string }
class ConflictingOptionsError extends NodeFameError { details: string }
class GitCommandError        extends NodeFameError {
  cmd: string; cwd: string; stderr: string; exitCode: number;
}
class AbortError             extends NodeFameError { }
```

Every class has a stable `.code` string (snake_case) so consumers can switch
on codes without relying on `instanceof`, which breaks across bundler
boundaries.

Hard errors throw **before** or **at the start of** analysis. File-level
failures never throw — they accumulate in `report.warnings` and the pipeline
keeps going.

### `AbortSignal` semantics

1. If `signal.aborted === true` at entry: throw `AbortError` immediately, no
   spawns happen.
2. During analysis: every `spawnGit()` receives the signal; on abort, the
   child receives `SIGTERM`, followed by `SIGKILL` after 500ms if it is still
   alive.
3. Pending `for await` loops reject with `AbortError`; the rejection
   propagates up to `analyze()` which rethrows.
4. Partial results are **never** returned. Abort = full reject.
5. Every `addEventListener('abort', ...)` has a matching `removeEventListener`
   in `finally`, to prevent listener leaks.

### Progress events

```ts
type ProgressEvent =
  | { type: 'phase'; phase: 'discover' | 'log' | 'blame' | 'aggregate' }
  | { type: 'discover'; filesFound: number }
  | { type: 'log'; commitsProcessed: number }
  | { type: 'blame'; file: string; done: number; total: number }
  | { type: 'warning'; warning: Warning };
```

Callback-style. Simpler to test (mock function), simpler to integrate with
any progress-bar library, simpler to ignore when not needed. An
`AsyncIterable`-based API is possible future work but is not built now.

### What is NOT exported

All code under `src/internal/**` is private and never appears in
`package.json#exports`. This includes the porcelain parsers, spawn helpers,
concurrency limiter, filter modules, mailmap loader, and glob matcher. Tests
reach them via relative imports from `tests/`.

### Peer requirements

- **Node.js ≥ 20** — needed for `AbortSignal`, modern async iterators,
  stable `readline/promises`.
- **git ≥ 2.30** — checked at startup; `GitNotInstalledError` thrown if
  missing or too old.

---

## Section 3 — Architecture and components

### Package layout

```
node-fame/
├── src/
│   ├── index.ts                     # public API re-exports
│   ├── analyze.ts                   # analyze() orchestrator
│   ├── analyze-many.ts              # analyzeMany() orchestrator
│   ├── types.ts                     # public types (Report, AuthorStats, ...)
│   ├── errors.ts                    # typed error classes
│   │
│   ├── internal/                    # NOT exported from package.json
│   │   ├── git/
│   │   │   ├── spawn.ts             # spawnGit(args, cwd, signal) → child
│   │   │   ├── version.ts           # assertGitInstalled()
│   │   │   ├── repo.ts              # isGitRepo, resolveRev, resolveRange
│   │   │   ├── ls-files.ts          # listTrackedFiles(headSha)
│   │   │   └── submodules.ts        # discoverSubmodules, isInitialized
│   │   │
│   │   ├── parse/
│   │   │   ├── blame-porcelain.ts   # stream → AsyncIterable<BlameLine>
│   │   │   └── log-numstat.ts       # stream → AsyncIterable<LogCommit>
│   │   │
│   │   ├── filter/
│   │   │   ├── glob.ts              # picomatch wrapper
│   │   │   ├── binary.ts            # .gitattributes + fallback sniff
│   │   │   ├── generated.ts         # linguist-generated + built-in patterns
│   │   │   ├── minified.ts          # avg-line-length heuristic
│   │   │   └── whitespace.ts        # isWhitespaceOnly(line)
│   │   │
│   │   ├── identity/
│   │   │   ├── mailmap.ts           # load .mailmap, canonicalize
│   │   │   └── aggregate.ts         # Map<canonicalEmail, MutableAuthorStats>
│   │   │
│   │   ├── pipeline/
│   │   │   ├── discover.ts          # phase 1
│   │   │   ├── log.ts               # phase 2
│   │   │   ├── blame.ts             # phase 3 (parallel, streaming)
│   │   │   └── assemble.ts          # phase 4 (merge blame+log into Report)
│   │   │
│   │   └── concurrency/
│   │       └── p-limit.ts           # minimal semaphore or thin wrap
│   │
│   └── render/
│       ├── index.ts                 # render(report, format, options) dispatch
│       ├── columns.ts               # Column defs + derived field computation
│       ├── table.ts                 # cli-table3-based table renderer
│       ├── json.ts
│       ├── csv.ts
│       └── markdown.ts
│
├── cli/
│   ├── bin.ts                       # commander setup, main()
│   ├── flags.ts                     # flag → AnalyzeOptions mapping
│   └── progress.ts                  # ProgressEvent → progress bar adapter
│
├── tests/
│   ├── fixtures/                    # parser fixture outputs, reusable helpers
│   ├── unit/                        # pure-function tests
│   ├── integration/                 # real git spawns on ephemeral fixture repos
│   └── e2e/                         # spawned CLI binary assertions
│
├── docs/
│   ├── superpowers/
│   │   └── specs/
│   │       └── 2026-04-08-node-fame-design.md   # this document
│   └── perf-notes.md                # benchmark results, updated per release
│
├── ROADMAP.md                       # future-work backlog (created in M0)
├── README.md                        # user documentation (M8)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
└── .husky/
    ├── pre-commit
    └── pre-push
```

### Boundary rules

- `src/internal/**` is private; it never appears in `package.json#exports`.
- `src/render/**` is public but only through `render()` re-exported from
  `src/index.ts`.
- `cli/**` is a thin wrapper; it depends only on `src/index.ts` and never
  imports from `src/internal/**` directly.
- `src/internal/pipeline/**` is the only layer that knows about all phases.
  Every layer below knows only its own sub-domain.

### Data flow

Four phases. Phases 2 (log) and 3 (blame) run in parallel; phase 4 waits for
both.

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1 — DISCOVER (fast, sequential)                          │
│                                                                │
│   validate path → resolve rev/range → load mailmap →           │
│   git ls-files -z → glob filter → binary filter →              │
│   generated filter → minified filter (if opted-in)             │
│                                                                │
│   Output: string[] of absolute file paths to blame             │
└────────────────────────────────────────────────────────────────┘
               │
               ├──────────────────┬─────────────────────┐
               ▼                  ▼                     │
┌──────────────────────┐ ┌──────────────────────┐       │
│ PHASE 2 — LOG        │ │ PHASE 3 — BLAME      │       │
│ (streaming, 1 spawn) │ │ (streaming, N spawns)│       │
│                      │ │                      │       │
│ git log --numstat    │ │ for each file:       │       │
│   [range/rev/date]   │ │   git blame          │       │
│   --no-merges*       │ │     --line-porcelain │       │
│                      │ │     -M -C (if on)    │       │
│ parse → aggregate    │ │     [-w if on]       │       │
│ into MutableStats:   │ │     <rev>            │       │
│   linesAdded/Deleted │ │                      │       │
│   commits            │ │ parse → increment    │       │
│   files              │ │   linesAlive         │       │
│   first/lastCommit   │ │ (per author via      │       │
│                      │ │  mailmap-canon email)│       │
│                      │ │                      │       │
│                      │ │ pLimit(concurrency)  │       │
└──────────────────────┘ └──────────────────────┘       │
               │                  │                     │
               └─────────┬────────┘                     │
                         ▼                              │
┌────────────────────────────────────────────────────────┐
│ PHASE 4 — ASSEMBLE (sync, fast)                        │
│                                                        │
│   merge blame map into log map by canonical email      │
│   compute totals (lines, commits, files)               │
│   freeze → build immutable Report                      │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
                      Report
```

### Invariants

1. **Streaming always.** No phase holds the complete stdout of a git command
   in memory. `readline` produces line-by-line events that increment
   aggregator state immediately.
2. **One aggregation Map.** Phase 2 and Phase 3 write into disjoint fields of
   the same `MutableAuthorStats` values keyed by mailmap-canonical email.
   There is no race because Node is single-threaded, and the phases merge
   deterministically at Phase 4.
3. **AbortSignal propagates everywhere.** Every `spawnGit()` receives the
   signal in its signature. Every child process is registered with
   `signal.addEventListener('abort', ...)`. Pending parser iterators reject on
   abort.
4. **Warnings are append-only.** A single `WarningsCollector` object is
   passed through the pipeline; components call `push()` and never read.
5. **Filter and parser purity.** `isWhitespaceOnly`, `isGenerated`,
   `parseBlamePorcelain`, `parseLogNumstat` are pure functions / generators
   with no side effects. They are tested on strings without touching git.

### Key component signatures

#### `internal/git/spawn.ts`

```ts
export function spawnGit(
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): { stdout: Readable; done: Promise<void> };
```

- Uses `node:child_process.spawn`, `stdio: ['ignore', 'pipe', 'pipe']`.
- stderr is buffered to a string (typically small) and wrapped in
  `GitCommandError` if the exit code is non-zero.
- `done` resolves on exit 0, rejects on non-zero exit or abort.
- Environment is augmented with `LC_ALL=C` (stable messages, no locale
  surprises) and `GIT_OPTIONAL_LOCKS=0` (we are read-only; do not take
  `index.lock`).

#### `internal/parse/blame-porcelain.ts`

```ts
export async function* parseBlamePorcelain(
  stream: Readable,
): AsyncIterable<BlameLine>;

export type BlameLine = {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;       // unix seconds
  line: string;             // the actual content line
  isBoundary: boolean;
};
```

- Porcelain format is stable and documented: each result line is a header
  block (12+ lines) followed by one content line. Headers are cached per-SHA
  because git only emits author info on the first appearance of a SHA.
- Pure function over a `Readable`; tested against static fixture files under
  `tests/fixtures/parsers/*.porcelain.txt`.

#### `internal/parse/log-numstat.ts`

```ts
export async function* parseLogNumstat(
  stream: Readable,
): AsyncIterable<LogCommit>;

export type LogCommit = {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  files: Array<{ path: string; added: number; deleted: number }>;
};
```

- Format: `--pretty=format:%H%x00%an%x00%ae%x00%at --numstat -z`.
- NUL separators make it robust against newlines in names or messages.

#### `internal/filter/generated.ts`

```ts
export function isGenerated(
  relPath: string,
  gitattributes: Map<string, string[]>,
): boolean;
```

- Checks `.gitattributes` for `linguist-generated=true` or
  `linguist-vendored=true` first (github/linguist-compatible semantics).
- Falls back to a built-in pattern list based on a subset of linguist's
  `vendor.yml`: lock files, `dist/**`, `build/**`, `vendor/**`,
  `node_modules/**`, `**/*.min.{js,css}`, common generated file extensions.

#### `internal/identity/mailmap.ts`

```ts
export type Mailmap = {
  canonicalize(name: string, email: string): { name: string; email: string };
};

export function loadMailmap(repoRoot: string): Mailmap;
```

- Parses the repository's `.mailmap`, plus `$XDG_CONFIG_HOME/git/mailmap`,
  plus the file named by `git config mailmap.file`.
- When `applyMailmap: false`, returns an identity function.

#### `internal/identity/aggregate.ts`

```ts
export class Aggregator {
  blameLine(authorName: string, authorEmail: string, line: string): void;
  logCommit(
    sha: string, authorName: string, authorEmail: string,
    time: number, files: LogCommit['files'],
  ): void;
  collectWarning(warning: Warning): void;
  assemble(meta: Report['meta'], repo: Report['repo']): Report;
}
```

- Encapsulates `Map<canonicalEmail, MutableAuthorStats>`.
- `assemble()` freezes the data and produces the immutable `Report`.
  `authors` is unordered.

#### `internal/pipeline/blame.ts`

```ts
export async function runBlamePhase(
  files: string[],
  repoRoot: string,
  rev: string,
  opts: {
    followRenames: boolean;
    ignoreWhitespace: boolean;
    concurrency: number;
  },
  aggregator: Aggregator,
  onProgress: (done: number) => void,
  signal?: AbortSignal,
): Promise<void>;
```

- Uses `pLimit(concurrency)` to cap parallel spawns.
- Per file: `spawnGit` → `parseBlamePorcelain` → `for await` →
  `aggregator.blameLine(...)` → `onProgress(++done)`.
- A failure on a single file produces a `BLAME_FAILED` warning and the phase
  continues.

### Deferred-to-implementation details

- Concrete progress-bar library (`cli-progress` vs `listr2` vs hand-rolled
  on top of `ora`). Picked during M6 after observing behaviour on a real
  stream.
- Default `concurrency` value (start with `os.cpus().length`, tune if needed).
- Minified detector thresholds (average line length, single-line file size).
- Exact built-in generated pattern list (seeded from linguist, trimmed by
  experience).

---

## Section 4 — Error handling and edge cases

### Classification

Two levels, strictly separated:

**THROW — aborts analysis, rejects the promise with a typed error:**
- Input is fundamentally invalid: `path` does not exist, is not a git repo,
  git is not installed.
- Invalid configuration: `rev` and `range` both set, `rev` does not resolve,
  `range.from > range.to`.
- A top-level git command fails (`git rev-parse HEAD`, the root
  `git log` invocation). A broken repository cannot yield a partial report.
- The user aborted via `AbortSignal`.

**WARNING — accumulated in `report.warnings`, analysis continues:**
- A single file fails to blame: broken, missing in rev, locked by the OS,
  race with an external delete.
- An uninitialised submodule during `--submodules` analysis.
- A file skipped by a built-in filter (binary, generated, minified), but only
  when the user requested verbose warnings via a CLI flag.
- A file larger than the soft limit (`LARGE_FILE`).
- A `.mailmap` line that fails to parse.

**Principle:** one broken file out of twenty thousand must not break the
report. A broken repository, by contrast, breaks everything immediately — no
half-valid partial results.

### Error taxonomy

| Error class                 | Cause                                                   |
| --------------------------- | ------------------------------------------------------- |
| `NotAGitRepoError`          | Path exists but is not a git directory                  |
| `GitNotInstalledError`      | `git --version` fails or git is too old                 |
| `InvalidRevError`           | `rev` / `range.from` / `range.to` does not resolve      |
| `ConflictingOptionsError`   | Mutually exclusive options set together                 |
| `GitCommandError`           | A top-level git spawn exited non-zero                   |
| `AbortError`                | `signal.aborted` at any checkpoint                      |
| `NodeFameError`             | Base class; exported for `instanceof` checks            |

All exported from `src/errors.ts` and re-exported publicly from
`src/index.ts`. Every class carries a stable `code: string` property in
snake_case.

### Edge cases and expected behaviour

| Case                                                      | Behaviour                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| Empty repo (init, 0 commits)                              | `Report` with `authors: []`, `totals.lines = 0`. No throw.      |
| Repo with commits but 0 tracked files                     | Same as above.                                                  |
| All files filtered out                                    | Same, plus an `ALL_FILES_FILTERED` warning as a hint.           |
| Detached HEAD                                             | Works. `repo.headRef = 'HEAD (detached)'`, SHA resolves.        |
| Non-UTF-8 file                                            | git produces replacement chars; lines are counted. `INVALID_UTF8` warning is collected in `report.warnings`; CLI prints it only under verbose output. |
| CRLF / mixed line endings                                 | Split on `/\r\n|\r|\n/`. Whitespace detection works on both.    |
| Binary file not detected as binary                        | Porcelain parser fails cleanly on the file → `BLAME_FAILED` warning, file is skipped. The advantage of porcelain over regex: we **see** the format break rather than silently ingest garbage. |
| File > 10 MB                                              | `LARGE_FILE` warning, still counted. Five or more large files trigger a top-level `MANY_LARGE_FILES` hint. |
| Symlink                                                   | `git ls-files` returns the symlink path; blame returns one line (the target). Counted normally. |
| File deleted between discovery and blame                  | `BLAME_FAILED` warning, file is skipped.                        |
| Uninitialised submodule (when `--submodules`)             | `UNINIT_SUBMODULE` warning, skipped. Never auto-init.           |
| `.gitmodules` mentions a missing directory                | Same as above.                                                  |
| Broken submodule gitdir                                   | `SUBMODULE_BROKEN` warning, skipped.                            |
| Merge conflict markers in a file                          | Counted as normal text.                                         |
| `.mailmap` with invalid lines                             | Line skipped, `MAILMAP_PARSE` warning.                          |
| `.mailmap` absent                                         | Identity canonicalisation used.                                 |
| Same email, different names across commits                | `AuthorStats.name` = mailmap-canonical first, else most recent. |
| Non-ASCII paths or author names                           | `ls-files -z` + NUL separators, UTF-8 decode. Test-case in fixtures. |
| Git version < 2.30                                        | `GitNotInstalledError` with an upgrade hint.                    |
| Non-C locale                                              | `LC_ALL=C` in spawn env; porcelain is locale-independent anyway.|
| Repository lock                                           | `GIT_OPTIONAL_LOCKS=0`; reads do not take locks.                |
| Concurrent `git rebase` / `git gc` in the same repo       | May cause individual `BLAME_FAILED` warnings; not our job to guard against concurrent repo modification. |

### `AbortSignal` semantics (detailed)

1. Before phase 1: if `signal.aborted`, throw `AbortError` immediately — no
   spawns happen.
2. During phase 1: signal checked at each boundary between git commands.
3. During phases 2/3: every `spawnGit()` receives the signal in its signature.
   Each child registers `signal.addEventListener('abort', () =>
   child.kill('SIGTERM'))`. A 500ms `setTimeout` escalates to `SIGKILL`.
4. All pending `for await` loops reject with `AbortError`, which bubbles up
   to `analyze()`.
5. Partial results are **never** returned.
6. Listener cleanup: every `addEventListener` has a matching
   `removeEventListener` in `finally`.

### CLI exit codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| 0    | Success, report rendered                                             |
| 1    | Analysis threw a typed error (broken repo or bad config)             |
| 2    | Invalid CLI args (commander validation)                              |
| 130  | SIGINT — CLI traps it, signals abort, waits for cleanup, exits 130  |

Warnings do **not** affect exit codes. A `--fail-on-warning` flag is listed
as future work in `ROADMAP.md`; not included in v0.1.0.

### Explicitly out of scope for this section

- Retry logic on flaky git commands. Git is deterministic; retries are not
  needed.
- Recovery from partial states. Abort = discard and restart.
- Separate error log file. Warnings go through `report.warnings` and
  `--verbose` output.

---

## Section 5 — Testing strategy

### Stack

- **Runner:** `vitest`.
- **Assertions:** built-in `expect`, `vi.fn()` for mocks.
- **Coverage:** `@vitest/coverage-v8`.
- **Fixture repositories:** created programmatically in `node:os.tmpdir()`
  per-test, cleaned up in `afterAll`. No pre-built git repos committed to the
  project.

### Three test layers

#### Layer 1 — Unit (pure functions, zero IO)

Exhaustive tests for every module in `src/internal/parse/**`,
`src/internal/filter/**`, `src/internal/identity/**`, `src/render/**`, and
`src/errors.ts`. These are the components where correctness matters most and
where IO is absent, so tests read like specifications.

| Module                         | Focus                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `parse/blame-porcelain.ts`     | Valid porcelain blocks; header caching per SHA; clean failure on corrupted input; non-ASCII name/mail; CRLF; empty input. |
| `parse/log-numstat.ts`         | NUL separators; `-` in numstat (binary) → 0/0; merges filtered; 0-file commits.                        |
| `filter/glob.ts`               | Gitignore semantics: negation (`!`), `**/`, `*.js`, trailing `/`, anchored `/foo`; include+exclude interaction. |
| `filter/binary.ts`             | `.gitattributes binary`; NUL-byte sniff fallback; plain text → not binary.                             |
| `filter/generated.ts`          | `linguist-generated`; `linguist-vendored`; built-in patterns (lock files, `dist/`, `vendor/`, `*.min.js`). |
| `filter/minified.ts`           | Single-line 20KB file → minified; average line length threshold; normal JS → not minified.            |
| `filter/whitespace.ts`         | Empty lines; tab-only; space-only; `}`-only → whitespace; code lines → not whitespace.                 |
| `identity/mailmap.ts`          | Four `.mailmap(5)` formats; invalid lines ignored with warning; priority rules; no-op when disabled.  |
| `identity/aggregate.ts`        | `blameLine` increments `linesAlive`; `logCommit` increments the right fields; `first/lastCommit` min/max; canonical email groups authors; `assemble()` returns an immutable Report. |
| `concurrency/p-limit.ts`       | N parallel tasks; completion order; rejection handling; respects `AbortSignal`.                        |
| `render/columns.ts`            | Derived fields; `linesNet = added - deleted`; `percentAlive = linesAlive / totalLines * 100`; divide-by-zero → `0.0`. |
| `render/{table,json,csv,markdown}.ts` | Snapshot tests against a fixed `Report`.                                                       |
| `errors.ts`                    | `instanceof NodeFameError` works; stable `.code` values; message formatting.                           |

Parser fixtures live in `tests/fixtures/parsers/*.{porcelain,numstat}.txt` as
static files, generated once by hand from real `git blame --line-porcelain`
output. New edge cases are added by generating a new fixture and committing
it.

#### Layer 2 — Integration (real git on programmatically-built repos)

This is where we validate **algorithmic correctness end-to-end**. Every test:

1. `beforeAll`: create `tmpdir/node-fame-test-<uuid>/`, `git init`, set
   local `user.name`/`user.email` (never global).
2. Create a controlled commit history via `git` CLI spawned from the test,
   with `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` set for reproducibility.
3. Call `analyze({ path: tmpdir })`.
4. Assert precise numbers in the returned `Report`.
5. `afterAll`: `rm -rf`.

A single helper manages repo construction:

```ts
// tests/helpers/build-repo.ts
export async function buildRepo(script: RepoScript): Promise<string>;

// example
const repo = await buildRepo([
  { author: 'Alice <a@x>', date: '2024-01-01', files: { 'a.ts': 'line1\nline2\n' } },
  { author: 'Bob <b@x>',   date: '2024-01-02', files: { 'a.ts': 'line1\nline2\nline3\n' } },
  { author: 'Alice <a@x>', date: '2024-01-03', delete: ['a.ts'] },
]);
```

The helper itself is meta-tested.

**Critical integration tests (one repo per scenario):**

| Test                                             | What it verifies                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| basic — single author, single file               | Sanity: 10 lines, one author → `linesAlive=10, linesAdded=10, commits=1`.                   |
| two authors — blame shows current ownership      | Alice writes 100, Bob rewrites 50 → Alice `linesAlive=50`, Bob `linesAlive=50`. **Most important test** — direct contrast with where git-fame often lies. |
| whitespace-only changes do not steal blame       | Alice writes code, Bob runs prettier → default (`-w` on) keeps Alice as author.              |
| rename — `-M -C` follows history                 | Alice creates `old.ts`, Bob `git mv`s to `new.ts` → Alice still owns the content.           |
| merge commits excluded from counts               | Numbers after a merge match numbers before — no numstat doubling.                           |
| binary file skipped                              | PNG produces `FILE_SKIPPED_BINARY` warning, not counted.                                    |
| generated file skipped via `.gitattributes`      | `dist/bundle.js` with `linguist-generated=true` → skipped.                                  |
| mailmap canonicalises identity                   | Two emails for one person merge into one `AuthorStats` entry.                                |
| range analysis (`v1..v2`)                        | `linesAdded` only counts commits in range.                                                   |
| since/until log filter                           | Date filter affects `linesAdded`; `linesAlive` stays HEAD.                                   |
| empty repo returns empty Report                  | `authors: []`, no throw.                                                                     |
| invalid rev throws `InvalidRevError`             | Typed error.                                                                                 |
| deleted file mid-analysis → warning              | Race simulated; file deleted between ls-files and blame → `BLAME_FAILED`, report is valid.  |
| submodule (uninit) → warning + skip              | `.gitmodules` present, no `submodule update` → `UNINIT_SUBMODULE`.                          |
| submodule (init) merged into parent report       | `submodules: true` → submodule authors appear in main `Report`.                             |
| `--split-submodules` → `analyzeMany` returns N+1 | Parent plus each submodule.                                                                  |
| abort mid-blame cancels immediately              | Signal aborted 50ms in → `AbortError`, no zombie children.                                   |
| huge file → warning but still counted            | File > 10 MB produces `LARGE_FILE`; `linesAlive` increases.                                  |
| CRLF file counted correctly                      | Windows endings produce the same numbers as LF.                                              |
| non-ASCII author and path                        | UTF-8 everywhere.                                                                            |

#### Layer 3 — E2E (spawn the built CLI binary)

A small suite that runs `tsup build` and spawns `node dist/cli/bin.cjs` via
`child_process.spawn`. Verifies:

- `--help` lists every flag
- `--version` matches `package.json`
- `--format json` on a fixture repo → valid parseable JSON with expected
  fields
- `--format csv` → valid CSV, escaping correct on names with commas
- `--format markdown` → snapshot
- `--format table` → snapshot (with `COLUMNS=120` for determinism)
- Exit code 1 on non-existent repo
- Exit code 2 on invalid flag
- Exit code 130 on SIGINT
- `--recursive` on a directory with two repos → two report blocks
- `--submodules --split-submodules` → parent + one submodule block

### Fixture principles

1. No pre-built git repos committed to this project. Everything is generated
   in `tmpdir`.
2. Deterministic time via `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE`. Never
   "now".
3. Per-repo local git config (`git -c user.name=...`) — tests do not read
   global `~/.gitconfig`.
4. One test = one repo. No shared state.
5. Cleanup in `afterAll` with a fail-safe.
6. Parallel-safe: UUIDs in directory names so `vitest` can run with threads.

### Coverage targets

- **Unit:** 100% statement coverage for everything in `internal/parse/**`,
  `internal/filter/**`, `internal/identity/**`, `render/**`, and `errors.ts`.
  Small pure modules; 100% is realistic.
- **Integration:** coverage-as-metric is secondary; the contract is that
  every behavioural requirement in Section 4 has at least one test.
- **E2E:** smoke tests and format snapshots, no coverage target.

Overall repository target: **≥ 90% line coverage globally**, with a strict
100% gate on the unit-level modules listed above.

### TDD discipline

Every new algorithmic component is built test-first: a failing test, then a
minimum implementation, then green, then refactor. This is the direct
consequence of the "quality over speed" guiding principle and catches
correctness regressions immediately.

Integration tests are written alongside the pipeline phase they exercise.
Every new phase (`discover`, `log`, `blame`, `assemble`) is integrated into
`analyze()` only after it has at least three passing integration tests.

### Explicitly out of scope

- Property-based testing (`fast-check`). Valuable for parsers; deferred.
- Mutation testing (`stryker`). Deferred.
- Benchmark suite in CI. Benchmarks run manually against real repositories
  and are recorded in `docs/perf-notes.md`.
- Visual regression tests for the table renderer. Text snapshots are enough.
- Dedicated tests for the `tsup` build. CI simply runs `tsup build && node
  dist/...`; failures surface there.

---

## Section 6 — Package config, build, dependencies

### `package.json` (final shape)

```jsonc
{
  "name": "node-fame",
  "version": "0.1.0",
  "description": "Fast, accurate git contribution stats — lines, commits, files per author.",
  "license": "MIT",
  "author": "Mykhailo Kalashnikov",
  "type": "module",
  "engines": { "node": ">=20" },

  "bin": { "node-fame": "./dist/cli/bin.cjs" },

  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import":  { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },

  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },

  "scripts": {
    "lint":     "eslint . && tsc --noEmit",
    "lint:fix": "eslint . --fix",
    "test":     "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage",
    "format":   "prettier --write .",
    "build":    "tsup",
    "dev":      "tsup --watch",
    "prepare":  "husky",
    "prepublishOnly": "npm run lint && npm run test:run && npm run build"
  },

  "lint-staged": {
    "*.{ts,js,cjs,mjs}":         ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}":      ["prettier --write"]
  }
}
```

Key points:

- Dual `exports` (ESM + CJS), dual type files (`.d.ts` and `.d.cts`) —
  NodeNext-compatible, generated by `tsup`.
- `bin` points at CJS: CLI scripts start faster in CJS and avoid ESM-specific
  corner cases on older Node.
- `files: ["dist", ...]` publishes only the build output; no sources or tests
  leak to npm.
- `engines: ">=20"` because we rely on `AbortSignal`, modern async iterators,
  and `readline/promises`.
- `prepare: "husky"` is the npm lifecycle hook that installs git hooks on
  `npm install`. No one forgets to "enable hooks".
- `prepublishOnly` enforces lint + test + build before any `npm publish`.

### Runtime dependencies

All pinned to **latest stable at implementation time**, verified via the
`context7` MCP server before `npm install` at M0.

| Package                         | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `@commander-js/extra-typings`   | CLI argparse with typed options                           |
| `cli-table3`                    | Table output                                              |
| `picomatch`                     | Gitignore-style globs for include/exclude                 |
| `p-limit`                       | Concurrency limiter for the blame phase                   |
| `<progress-bar>`                | CLI progress bar — final choice deferred to M6 (candidates: `cli-progress`, `listr2`, or a hand-roll on top of `ora`) |

**Removed** from the old scaffold: `simple-git`, `winston`, `@swc/helpers`,
`ora` (unless the progress-bar decision picks it).

### Dev dependencies

| Package                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `typescript`            | `tsc --noEmit` for type-checking, type generation for tsup |
| `tsup`                  | Build (ESM + CJS + dts)                                    |
| `vitest`                | Test runner                                                |
| `@vitest/coverage-v8`   | V8 coverage                                                |
| `@types/node`           | Node built-in module types                                 |
| `prettier`              | Code formatting                                            |
| `eslint`                | Linter (9.x, flat config)                                  |
| `typescript-eslint`     | Meta-package: parser + plugin                              |
| `husky`                 | Git hooks manager                                          |
| `lint-staged`           | Runs lint/format only on staged files                      |

**Removed** from the old scaffold: `webpack`, `webpack-cli`, `webpack-merge`,
`swc-loader`, `@swc/cli`, `@swc/core`, `ts-node`,
`rollup-plugin-node-externals`, `tsconfig-paths-webpack-plugin`,
`@types/commander`, `@types/cli-progress`.

Note: we do **not** use `@eslint/js`. A TypeScript-only project gets its
baseline rule set from `typescript-eslint`'s `strictTypeChecked` +
`stylisticTypeChecked` configs; the handful of useful base ESLint rules that
are not TS-specific are enabled individually in the config below.

Note on the `lint` script: `eslint` and `tsc --noEmit` are **complementary,
not redundant**. `tsc` reports type errors; ESLint reports lint-rule
violations. Typed-lint rules in `typescript-eslint` use the TypeScript
type-checker API to **inform** their rules (e.g. `no-floating-promises` needs
to know when an expression is a Promise), but ESLint does **not** report type
errors itself. We need both, always.

### `tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig([
  // Library entry
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    splitting: false,
    treeshake: true,
  },
  // CLI entry
  {
    entry: { 'cli/bin': 'cli/bin.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    splitting: false,
  },
]);
```

### `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,

    "resolveJsonModule": true,
    "declaration": true,
    "noEmit": true,

    "baseUrl": ".",
    "paths": {
      "@/*":         ["src/*"],
      "@internal/*": ["src/internal/*"]
    }
  },
  "include": ["src", "cli", "tests", "tsup.config.ts", "vitest.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
friends) catch classes of bugs that default strict does not. `noEmit: true`
because tsup owns the build.

### `eslint.config.js` (flat config, ESLint 9+)

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Critical for an async-heavy codebase
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises':  'error',
      '@typescript-eslint/await-thenable':       'error',
      '@typescript-eslint/require-await':        'error',

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Handful of base rules not covered by TypeScript
      'no-async-promise-executor': 'error',
      'no-duplicate-case':         'error',
      'eqeqeq':                    ['error', 'always'],
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion':     'off',
      '@typescript-eslint/no-unnecessary-condition':  'off',
    },
  },
);
```

`strictTypeChecked` requires `parserOptions.project`, which makes ESLint load
the TypeScript type-checker. That is what enables typed rules like
`no-floating-promises` to work correctly. The cost is slower lints, which is
acceptable.

Prettier is configured separately; no `eslint-config-prettier` is needed
because we do not enable formatting rules in ESLint.

### Git hooks

`.husky/pre-commit`:
```sh
npx lint-staged
```

`.husky/pre-push`:
```sh
npm run test:run
```

Pre-commit is fast because `lint-staged` only processes staged files.
Pre-push runs the full test suite because by then we are about to share the
code.

We do **not** add a `commit-msg` hook (conventional commits are a separate
discipline, not needed for a single-maintainer project).

The design does not forbid `--no-verify`; that is a maintenance-policy
question, not an architectural one.

### `.prettierrc`, `.editorconfig`

Kept from the existing scaffold, with prettier bumped to the current major.

### `.gitignore`

Kept; `coverage/` and `*.log` added.

### Node version pinning

- `engines.node = ">=20"` in `package.json`
- `.nvmrc` with a concrete LTS (e.g. `20.18`) for developer experience

### README

Out of scope for this section; written at M8 when the feature set is frozen.

---

## Section 7 — Roadmap, build order, risks

This section is the **high-level build plan** — milestones, risk areas, and
deferred decisions. A detailed step-by-step plan with tests, commits, and
checkpoints is the job of the next step (`writing-plans`).

### Milestones

Ordered by "earliest possible working slice". Each milestone produces a
working tool with a reduced feature set, not an architectural layer.

#### M0 — Bootstrap

Wipe `src/`, install modern tooling. End state: `npm install && npm run lint
&& npm run test:run && npm run build` all green on an empty project.

**Deliverables:**
- Final `package.json` (dependency versions verified via context7)
- `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`,
  `.prettierrc`, `.husky/*`, `lint-staged` config in `package.json`
- Empty `src/index.ts` with `export const version = '0.0.0'`
- First empty vitest, confirming the runner works
- First CI pipeline (GitHub Actions): lint + test + build on Node 20 and 22
- **`ROADMAP.md` at the repository root** with the future-work list from the
  "Out of scope" subsection below
- Deliverable overall: **infrastructure green, no product code yet**

#### M1 — Git foundation

Low-level git wrappers. End state: we can programmatically tell whether a
path is a git repo, resolve SHAs, and list tracked files.

- `internal/git/spawn.ts` — streaming `spawnGit()` with `AbortSignal`
- `internal/git/version.ts` — `assertGitInstalled()` with version parsing
- `internal/git/repo.ts` — `isGitRepo()`, `resolveRev()`, `resolveRange()`
- `internal/git/ls-files.ts` — `listTrackedFiles()` streaming
- `errors.ts` — all typed error classes
- Unit tests for errors, integration tests for the git wrappers against
  ephemeral fixture repos

#### M2 — Parsers

The heart of correctness. Two pure stream parsers, covered aggressively.

- `internal/parse/blame-porcelain.ts` — `AsyncGenerator<BlameLine>`
- `internal/parse/log-numstat.ts` — `AsyncGenerator<LogCommit>`
- Fixture files `tests/fixtures/parsers/*.{porcelain,numstat}.txt`
  hand-generated from real repositories
- Unit tests for every format branch and every edge case (merge, binary,
  non-ASCII, CRLF, empty input)

#### M3 — Minimal `analyze()` (first working slice, dogfood)

The moment we run `node-fame` on its own repository and see a real table for
the first time.

**Included:**
- `analyze()` only (no `analyzeMany`)
- Current HEAD only (no `rev`, no `range`)
- Phases 1–4, no submodules, no recursion
- Filter: only `include.binary: false`; everything else no-op
- Mailmap disabled
- Rendering: `table` only
- CLI: `node-fame [path]` only, no flags

**Excluded:**
- All filter flags
- JSON / CSV / Markdown output
- Progress bar
- Submodules, recursive
- `.mailmap`
- Range, since, until

**Deliverable:** `npx node-fame .` prints a table with real numbers.
Dogfood gate: the numbers must look sensible on `node-fame` itself before
moving on.

#### M4 — Correctness filters

The filters that make the numbers "real" — the direct answer to the
git-fame frustration.

- `internal/filter/whitespace.ts`
- `internal/filter/binary.ts`
- `internal/filter/generated.ts` (built-in list + `.gitattributes`)
- `internal/filter/minified.ts`
- `internal/filter/glob.ts` (picomatch)
- `internal/identity/mailmap.ts`
- CLI flags `--include-*` and `--no-*`
- Integration tests for every "with filter vs without filter" pair

#### M5 — Ref selection

- `rev`, `range`, `since`, `until` on `analyze()`
- Validation of conflicting options → `ConflictingOptionsError`
- Integration tests for range and since/until
- CLI flags `--rev`, `--range`, `--since`, `--until`

#### M6 — Rendering + progress

- `render/json.ts`, `render/csv.ts`, `render/markdown.ts`
- `render()` dispatcher
- CLI flags `--format`, `--sort`, `--limit`, `--columns`
- Final progress-bar library chosen and integrated with `onProgress`
- Snapshot tests for every format

#### M7 — Submodules and recursive

- `analyzeMany()`
- `internal/git/submodules.ts` — discovery, init check
- Integration tests for `--submodules`, `--split-submodules`, `--recursive`

#### M8 — Hardening, docs, release

- Every edge case from Section 4 has an integration test
- E2E suite from Section 5 (spawned CLI, SIGINT, exit codes)
- Benchmarks run on 2–3 real repositories of varying size, recorded in
  `docs/perf-notes.md`
- README with usage examples
- CI matrix: Node 20/22 × Ubuntu/macOS/Windows
- `npm publish --dry-run` check of packaged contents
- **v0.1.0 ready to publish**

### Risk areas

Where mistakes are most likely and must be handled carefully.

**High risk**
1. **Blame porcelain parser.** Stable but non-trivial format (per-SHA header
   caching, boundary lines, content lines for commitless files). The most
   critical component. Mitigation: aggressive unit tests, fixture files, a
   property-like roundtrip test (random header/content sequences in, parse,
   re-serialise, compare).
2. **`AbortSignal` propagation and listener cleanup.** It is easy to leak
   `MaxListenersExceededWarning` or zombie children. Mitigation: a single
   `attachAbort(child, signal)` helper with guaranteed `finally` cleanup,
   plus a test that spawns 1000 children without leaking listeners.
3. **Mailmap canonicalisation.** Four formats, subtle priority rules.
   Mitigation: unit tests per format, plus a test against a real `.mailmap`
   from an open-source repository (e.g. `git.git` itself).

**Medium risk**
4. **Gitignore-style glob semantics via picomatch.** Anchoring (`/foo`),
   negation (`!`), ordering. Mitigation: explicit picomatch options and
   behavioural tests ported from git's own test corpus.
5. **CRLF and mixed line endings.** A single `/\r\n|\r|\n/` split and a
   Windows-endings test.
6. **Non-UTF-8 files.** Decision deferred to M2: start with UTF-8 decode +
   replacement characters, switch to Buffer-level parsing only if it causes
   measurable incorrect counts.

**Low risk, worth watching**
7. **Concurrency limit too high** → "too many open files". Default to
   `os.cpus().length`; verify upper bound experimentally.
8. **Submodule detection from `.gitmodules`.** Use
   `git config -f .gitmodules --get-regexp` rather than hand-parsing INI.

### Deferred decisions (resolved during implementation)

| Question                                         | Resolved at |
| ------------------------------------------------ | ----------- |
| Concrete progress-bar library                    | M6          |
| Default concurrency value                        | M3          |
| Minified detector thresholds                     | M4          |
| Exact built-in generated pattern list            | M4          |
| UTF-8 vs Buffer for blame content lines          | M2          |

### Definition of done for v0.1.0

All of the following must be green before `npm publish`:

- [ ] Every integration test from Section 5 passes
- [ ] Every unit test passes; 100% coverage on the designated unit modules
- [ ] Every E2E test passes
- [ ] `npx node-fame .` against `node-fame`'s own repository produces a
      sensible report
- [ ] `npx node-fame --format json .` produces valid JSON matching the
      documented schema
- [ ] README with usage examples exists
- [ ] CI green on Node 20 and 22, Ubuntu/macOS/Windows
- [ ] `npm publish --dry-run` contains no garbage (no `src/`, `tests/`,
      `configs/`)
- [ ] Benchmarks run on at least two real repositories; notes in
      `docs/perf-notes.md`
- [ ] No `TODO`/`FIXME` in code outside explicitly-deferred items
- [ ] `npm run lint` green

### Explicitly out of scope for v0.1.0

The full backlog lives in `ROADMAP.md` at the repository root. The
abbreviated list:

- Worker threads for blame parsing
- Cross-run result cache by commit SHA
- Incremental analysis (diff against the previous run)
- `--bytype` / `--bydir` (by language / directory breakdown)
- HTML / SVG reports
- Public `AsyncIterable` API for progress events (callback only in v0.1.0)
- `--fail-on-warning` CLI flag
- Submodule recursion deeper than one level
- Support for non-git VCS
- Config file (`.node-famerc`)

`ROADMAP.md` is created during M0 and is the canonical place to look when
planning post-v0.1 work.

---

*End of spec.*
