# M6 Rendering & Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the output layer. After this plan, `node-fame --format json`, `--format csv`, and `--format markdown` produce well-formed output, `--sort` / `--limit` control presentation, and a progress bar shows blame-phase progress on large repos.

**Architecture:** Three new renderer functions (`renderJson`, `renderCsv`, `renderMarkdown`) are added under `src/render/`, each in its own folder. A shared `prepareAuthors` helper applies sort, limit, and derived-field computation (percentAlive, linesNet) before any renderer touches the data — DRY across four formats. `RenderOptions` and `RenderFormat` types expand. The CLI gets `--sort` and `--limit` flags. For the progress bar, `cli-progress` is installed; `AnalyzeOptions` gains an `onProgress` callback; `runBlamePhase` calls it per-file; the CLI wires `cli-progress.SingleBar` to the callback.

**Tech Stack:** TypeScript 6, Node 20+, vitest 4, cli-progress (new runtime dep).

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By. See `CLAUDE.md`.

**Context:** M5 complete (252 tests, full filter + ref selection + commander CLI). `render()` at `src/render/render.ts` currently supports only `'table'` format. `renderTable` at `src/render/table/render-table.ts` sorts by linesAlive desc and computes percentAlive inline. No `RenderOptions` type exists yet.

---

## File structure

### New files

| Path                                          | Responsibility                              |
| --------------------------------------------- | ------------------------------------------- |
| `src/render/types/render-options.type.ts`     | `RenderOptions` + `Column` types            |
| `src/render/helpers/prepare-authors.ts`       | Shared: sort, limit, compute derived fields |
| `src/render/helpers/prepare-authors.test.ts`  | Unit tests                                  |
| `src/render/json/index.ts`                    | barrel                                      |
| `src/render/json/render-json.ts`              | `renderJson(report, options)`               |
| `src/render/json/render-json.test.ts`         | Snapshot + structural tests                 |
| `src/render/csv/index.ts`                     | barrel                                      |
| `src/render/csv/render-csv.ts`                | `renderCsv(report, options)`                |
| `src/render/csv/render-csv.test.ts`           | Tests                                       |
| `src/render/markdown/index.ts`                | barrel                                      |
| `src/render/markdown/render-markdown.ts`      | `renderMarkdown(report, options)`           |
| `src/render/markdown/render-markdown.test.ts` | Tests                                       |
| `src/types/progress-event.type.ts`            | `ProgressEvent` discriminated union         |

### Modified files

| Path                                       | What changes                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `src/render/render.ts`                     | Expand `RenderFormat`, accept `RenderOptions`, dispatch to new renderers |
| `src/render/render.test.ts`                | Tests for new formats                                                    |
| `src/render/table/render-table.ts`         | Use `prepareAuthors` instead of inline sort + percent                    |
| `src/render/table/render-table.test.ts`    | Adapt to new signature                                                   |
| `src/render/index.ts`                      | Re-export `RenderOptions`, `Column`                                      |
| `src/types/analyze-options.type.ts`        | Add `onProgress`                                                         |
| `src/internal/pipeline/run-blame-phase.ts` | Call `onProgress` per file                                               |
| `src/analyze.ts`                           | Thread `onProgress`                                                      |
| `cli/parse-flags.ts`                       | Add `--sort`, `--limit`                                                  |
| `cli/parse-flags.test.ts`                  | New tests                                                                |
| `cli/bin.ts`                               | Wire cli-progress bar to onProgress                                      |
| `package.json`                             | Add `cli-progress` + `@types/cli-progress` deps                          |

---

## Task 1: Install `cli-progress` + types

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm install cli-progress && npm install -D @types/cli-progress`
- [ ] **Step 2:** Verify: `npm ls --depth=0 --prod` shows cli-progress
- [ ] **Step 3:** `npm run lint && npm run test:run` → 252 pass
- [ ] **Step 4:** `git add package.json package-lock.json && git commit -m "Install cli-progress runtime dependency"`

---

## Task 2: `RenderOptions` type + `prepareAuthors` shared helper

**Files:**

- Create: `src/render/types/render-options.type.ts`
- Create: `src/render/helpers/prepare-authors.ts`
- Create: `src/render/helpers/prepare-authors.test.ts`

### RenderOptions type

```ts
export type SortableColumn =
  | 'linesAlive'
  | 'linesAdded'
  | 'linesDeleted'
  | 'commits'
  | 'files'
  | 'lastCommit';

export interface RenderOptions {
  sort?: {
    by: SortableColumn;
    order?: 'asc' | 'desc';
  };
  limit?: number;
}
```

Note: `columns` from the spec is deferred — it adds complexity (dynamic column set) that no user has asked for. YAGNI. If needed, it's a follow-up.

### prepareAuthors

Shared helper used by ALL renderers. Takes `Report` + `RenderOptions`, returns a flat array of "prepared" rows with:

- Authors sorted by the requested column (default: linesAlive desc)
- Truncated to `limit` if provided
- Derived fields computed: `percentAlive`, `linesNet`

```ts
export interface PreparedAuthor {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  linesNet: number;
  commits: number;
  files: number;
  percentAlive: string; // formatted "75.0"
}

export const prepareAuthors = (report: Report, options?: RenderOptions): PreparedAuthor[] => {
  // sort, limit, compute derived
};
```

### Tests (8 cases)

1. Default sort: linesAlive desc
2. Sort by commits asc
3. Limit to top N
4. Computes percentAlive correctly
5. Computes linesNet = added - deleted
6. Handles empty authors
7. percentAlive is "0.0" when totalLines is 0
8. Sort order defaults to desc

TDD: test → fail → implement → pass → lint → commit.
Commit: `Add RenderOptions type and prepareAuthors shared helper`

---

## Task 3: Refactor `renderTable` to use `prepareAuthors`

**Files:**

- Modify: `src/render/table/render-table.ts`
- Modify: `src/render/table/render-table.test.ts`

Currently `renderTable` does its own sorting and percent computation. Replace with `prepareAuthors`. The function signature stays the same but uses the shared helper.

Update existing tests to verify the output unchanged (behavior should be identical — same default sort, same percent format).

Commit: `Refactor renderTable to use prepareAuthors`

---

## Task 4: JSON renderer

**Files:**

- Create: `src/render/json/render-json.ts`
- Create: `src/render/json/render-json.test.ts`
- Create: `src/render/json/index.ts`

`renderJson(report, options?)` returns `JSON.stringify` of a clean structure:

```json
{
  "meta": { "version": "0.1.0", "generatedAt": "2024-...", "durationMs": 42 },
  "repo": { "path": "/...", "headSha": "...", "headRef": "HEAD", "totals": {...} },
  "authors": [
    { "name": "Alice", "email": "a@x", "linesAlive": 100, "linesAdded": 120, "linesDeleted": 20, "linesNet": 100, "commits": 5, "files": 3, "percentAlive": "75.0" }
  ],
  "warnings": [...]
}
```

Uses `prepareAuthors` for the authors array. Dates converted to ISO strings. Indented with 2 spaces.

Tests (4):

1. Returns valid JSON
2. Authors sorted by default (linesAlive desc)
3. Respects `limit` option
4. Includes meta.version and repo.path

Commit: `Add JSON renderer`

---

## Task 5: CSV renderer

**Files:**

- Create: `src/render/csv/render-csv.ts`
- Create: `src/render/csv/render-csv.test.ts`
- Create: `src/render/csv/index.ts`

`renderCsv(report, options?)` returns CSV with header row + data rows. Uses `prepareAuthors`.

```
author,linesAlive,linesAdded,linesDeleted,linesNet,commits,files,percentAlive
"Alice <a@x>",100,120,20,100,5,3,75.0
```

Properly escapes commas and double quotes in author names/emails.

Tests (4):

1. Header row present
2. Values match report data
3. Handles commas in author names (quotes the field)
4. Respects sort/limit

Commit: `Add CSV renderer`

---

## Task 6: Markdown renderer

**Files:**

- Create: `src/render/markdown/render-markdown.ts`
- Create: `src/render/markdown/render-markdown.test.ts`
- Create: `src/render/markdown/index.ts`

`renderMarkdown(report, options?)` returns a GitHub-flavored Markdown table:

```markdown
| author        | linesAlive | linesAdded | linesDeleted | commits | files | percentAlive |
| ------------- | ---------- | ---------- | ------------ | ------- | ----- | ------------ |
| Alice \<a@x\> | 100        | 120        | 20           | 5       | 3     | 75.0         |
```

Escapes `|` and `<>` in author names. Uses `prepareAuthors`.

Tests (3):

1. Contains markdown table header with separator
2. Rows match report data
3. Escapes angle brackets in emails

Commit: `Add Markdown renderer`

---

## Task 7: Expand `render()` dispatcher + CLI flags

**Files:**

- Modify: `src/render/render.ts`
- Modify: `src/render/render.test.ts`
- Modify: `src/render/index.ts`
- Modify: `cli/parse-flags.ts`
- Modify: `cli/parse-flags.test.ts`

### Expand render()

```ts
export type RenderFormat = 'table' | 'json' | 'csv' | 'markdown';

export const render = (report: Report, format: RenderFormat, options?: RenderOptions): string => {
  // dispatch to the four renderers
};
```

Re-export `RenderOptions` and `RenderFormat` from `src/render/index.ts`.

### CLI flags

Add to parse-flags:

```ts
.option('--sort <column>', 'Sort by column (linesAlive, linesAdded, commits, etc.)', 'linesAlive')
.option('--limit <n>', 'Show only top N authors', parseInt)
```

Map to a `renderOptions` in the parsed result. Pass from `bin.ts` to `render()`.

Update bin.ts to pass render options:

```ts
const output = render(report, format as RenderFormat, renderOptions);
```

Tests for parse-flags (2 new):

1. --sort passes through
2. --limit parses as number

Tests for render (3 new):

1. 'json' format returns valid JSON
2. 'csv' format starts with header row
3. 'markdown' format contains markdown table separator

Commit: `Expand render dispatcher with json csv markdown and sort limit options`

---

## Task 8: Progress bar — `onProgress` + `cli-progress`

**Files:**

- Create: `src/types/progress-event.type.ts`
- Modify: `src/types/analyze-options.type.ts` — add `onProgress`
- Modify: `src/internal/pipeline/run-blame-phase.ts` — call onProgress per file
- Modify: `src/analyze.ts` — thread onProgress
- Modify: `cli/bin.ts` — wire cli-progress

### ProgressEvent type

```ts
export type ProgressEvent =
  | { type: 'phase'; phase: 'discover' | 'log' | 'blame' | 'aggregate' }
  | { type: 'blame'; file: string; done: number; total: number };
```

Minimal for M6 — only blame-phase progress events. Discover/log/aggregate phase markers are emitted for UX but carry no granular data.

### AnalyzeOptions

Add: `onProgress?: (event: ProgressEvent) => void`

### runBlamePhase

Accept `onProgress` callback. After each file completes (success or fail), call:

```ts
onProgress?.({ type: 'blame', file, done: ++completed, total: files.length });
```

### analyze()

Thread `onProgress` from options to `runBlamePhase`. Also emit phase markers:

```ts
options.onProgress?.({ type: 'phase', phase: 'discover' });
// ... discover
options.onProgress?.({ type: 'phase', phase: 'log' });
// ... log
options.onProgress?.({ type: 'phase', phase: 'blame' });
// ... blame (with per-file progress)
options.onProgress?.({ type: 'phase', phase: 'aggregate' });
```

### CLI bin.ts

When stdout is a TTY, create a `cli-progress.SingleBar`:

```ts
import cliProgress from 'cli-progress';

let bar: cliProgress.SingleBar | undefined;

const onProgress = (event: ProgressEvent): void => {
  if (event.type === 'blame' && bar === undefined) {
    bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(event.total, 0);
  }
  if (event.type === 'blame' && bar !== undefined) {
    bar.update(event.done);
  }
  if (event.type === 'phase' && event.phase === 'aggregate' && bar !== undefined) {
    bar.stop();
  }
};
```

Only show the bar when `process.stdout.isTTY` — piped output stays clean.

Tests: No automated tests for the progress bar (TTY-dependent, visual). The blame-phase `onProgress` callback IS tested via a mock in `run-blame-phase.test.ts`:

```ts
it('calls onProgress after each file', async () => {
  // ... buildRepo with 2 files
  const events: ProgressEvent[] = [];
  await runBlamePhase(dir, ['a.txt', 'b.txt'], agg, blameOpts, (ev) => events.push(ev));
  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({ type: 'blame', done: 1, total: 2 });
  expect(events[1]).toMatchObject({ type: 'blame', done: 2, total: 2 });
});
```

Commit: `Add onProgress callback and cli-progress bar for blame phase`

---

## Task 9: Dogfood verification

**Files:** none

- [ ] **Step 1: Build**

```bash
rm -rf dist && npm run build
```

- [ ] **Step 2: Test all four formats on store repo**

```bash
node dist/cli/bin.js --format table /Users/mike/work/store
node dist/cli/bin.js --format json /Users/mike/work/store | head -30
node dist/cli/bin.js --format csv /Users/mike/work/store
node dist/cli/bin.js --format markdown /Users/mike/work/store
```

Verify each produces valid, well-formed output.

- [ ] **Step 3: Test sort and limit**

```bash
node dist/cli/bin.js --sort commits --limit 5 /Users/mike/work/store
```

- [ ] **Step 4: Test progress bar**

```bash
node dist/cli/bin.js /Users/mike/work/store
```

On a TTY, the progress bar should appear during the blame phase and fill to 100%, then the table prints.

- [ ] **Step 5: Test piped output (no progress bar)**

```bash
node dist/cli/bin.js /Users/mike/work/store > /tmp/out.txt && head -5 /tmp/out.txt
```

Progress bar should NOT appear in the file.

- [ ] **Step 6: Lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 7: Verify commit history**

```bash
git log --oneline feat/initial ^main | head -12
```
