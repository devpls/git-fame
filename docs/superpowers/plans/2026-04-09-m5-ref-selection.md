# M5 Ref Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users analyze any ref, range, or date window — not just HEAD. After this plan, `node-fame --rev v1.0 .` analyses at tag v1.0, `node-fame --from v1.0 --to v2.0 .` analyses commits in a range, and `--since`/`--until` filters the log phase by date.

**Architecture:** `AnalyzeOptions` grows four new fields (`rev`, `range`, `since`, `until`). `analyze()` validates that `rev` and `range` are not both set (`ConflictingOptionsError`). The `discover` phase resolves the target ref(s) to SHA(s). `runLogPhase` appends range/date args to `git log`. `runBlamePhase` uses the resolved rev SHA (not hardcoded `'HEAD'`). The `assembleReport` phase populates `Report.repo.range` when a range was used. The CLI adds 5 new flags via commander.

**Tech Stack:** TypeScript 6, Node 20+, vitest 4. No new runtime dependencies.

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. See `CLAUDE.md`.

**Context for implementer:** M4 is complete (237 tests, full filter suite, commander CLI). `resolveRev` and `resolveRange` already exist in `src/internal/git/resolve-rev.ts` and `src/internal/git/resolve-range.ts`. The `discover` phase currently hardcodes `'HEAD'` as the ref. The `runBlamePhase` hardcodes `'HEAD'` in blame args. The `runLogPhase` has no range or date filters. `Report.repo.range?` field already exists in the type but is never populated.

---

## File structure

No new modules needed — this milestone modifies existing files only.

### Modified files

| Path                                            | What changes                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `src/types/analyze-options.type.ts`             | Add `rev`, `range`, `since`, `until`                             |
| `src/internal/pipeline/discover.ts`             | Accept rev/range, resolve SHA(s), return resolved info in result |
| `src/internal/pipeline/discover.test.ts`        | New tests for rev and range resolution                           |
| `src/internal/pipeline/run-log-phase.ts`        | Accept range + since/until, build git log args dynamically       |
| `src/internal/pipeline/run-log-phase.test.ts`   | New tests for range and date filters                             |
| `src/internal/pipeline/run-blame-phase.ts`      | Accept resolved rev instead of hardcoded HEAD                    |
| `src/internal/pipeline/run-blame-phase.test.ts` | New test for blame at a specific rev                             |
| `src/internal/pipeline/assemble-report.ts`      | Accept optional range info, populate `Report.repo.range`         |
| `src/internal/pipeline/assemble-report.test.ts` | New test for range field                                         |
| `src/analyze.ts`                                | Validate conflicts, resolve rev/range, thread through phases     |
| `src/analyze.test.ts`                           | End-to-end tests for rev, range, since/until, and conflict       |
| `cli/parse-flags.ts`                            | Add `--rev`, `--from`, `--to`, `--since`, `--until` flags        |
| `cli/parse-flags.test.ts`                       | New tests for the 5 new flags                                    |

---

## Task 1: Expand `AnalyzeOptions` with ref selection fields

**Files:**

- Modify: `src/types/analyze-options.type.ts`

- [ ] **Step 1: Read the current file**

Read `src/types/analyze-options.type.ts` to see the current shape.

- [ ] **Step 2: Replace the file**

Add four new fields. Per spec §2, `rev` and `range` are mutually exclusive (validated at runtime). `since`/`until` are `Date` objects that filter the log phase. The type does NOT enforce mutual exclusion — that's a runtime check in `analyze()`.

```ts
export interface AnalyzeOptions {
  path: string;

  /** Single commit-ish to analyze. Default: 'HEAD'. Mutually exclusive with `range`. */
  rev?: string;

  /** Commit range to analyze. Mutually exclusive with `rev`. */
  range?: {
    from: string;
    to: string;
  };

  /** Only count log entries after this date. Blame is always at the upper ref. */
  since?: Date;

  /** Only count log entries before this date. Blame is always at the upper ref. */
  until?: Date;

  include?: {
    whitespace?: boolean;
    binary?: boolean;
    generated?: boolean;
    minified?: boolean;
  };

  options?: {
    followRenames?: boolean;
    applyMailmap?: boolean;
  };

  includeGlobs?: string[];
  excludeGlobs?: string[];
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0. Type-only change, backward compatible.

- [ ] **Step 4: Commit**

```bash
git add src/types/analyze-options.type.ts
git commit -m "Add rev, range, since, until to AnalyzeOptions"
```

---

## Task 2: Update `discover` to resolve rev/range

**Files:**

- Modify: `src/internal/pipeline/discover.ts`
- Modify: `src/internal/pipeline/discover.test.ts`

Currently `discover` hardcodes `resolveRev(cwd, 'HEAD')`. Expand it to take an optional `rev` or `range`, resolve accordingly, and return resolved SHA(s) plus ref labels. When a range is provided, blame uses the upper bound (`to`).

- [ ] **Step 1: Read current discover.ts**

Read the file to understand the current interface.

- [ ] **Step 2: Expand `DiscoverOptions` and `DiscoverResult`**

Add to `DiscoverOptions`:

```ts
rev?: string;         // default 'HEAD'
range?: { from: string; to: string };
```

Expand `DiscoverResult` with range info:

```ts
export interface DiscoverResult {
  headSha: string; // resolved SHA of the blame target (rev or range.to)
  headRef: string; // human-readable ref label
  range?: {
    // populated when a range was provided
    fromSha: string;
    toSha: string;
    fromRef: string;
    toRef: string;
  };
  files: string[];
  warnings: Warning[];
}
```

Logic:

- If `range` is provided: resolve both endpoints via `resolveRange`. Set `headSha = toSha`, `headRef = range.to`. Populate `result.range`.
- Else: resolve `rev ?? 'HEAD'` via `resolveRev`. Set `headSha/headRef` accordingly. `result.range` stays undefined.

Update `listTrackedFiles` to use the resolved rev (pass it or keep using working tree — at M5 we still list from the working tree index, which reflects HEAD. A proper `git ls-tree -r --name-only <sha>` would be needed for non-HEAD analysis but is more complex. For M5 MVP, document this limitation: `ls-files` always lists HEAD's files. If the rev differs significantly, the list may be slightly off. Proper fix is M8 hardening).

- [ ] **Step 3: Add failing tests**

Add tests to `discover.test.ts`:

```ts
it('resolves a tag name as the analysis target', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'v1\n' } },
    { author: 'Alice <a@x>', date: '2024-01-02T00:00:00Z', files: { 'a.txt': 'v2\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });

  const result = await discover(dir, {
    ...defaultDiscoverOpts,
    rev: 'v1',
  });

  expect(result.headSha).toMatch(/^[0-9a-f]{40}$/);
  expect(result.headRef).toBe('v1');
  expect(result.range).toBeUndefined();
});

it('resolves a range and returns both endpoints', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'v1\n' } },
    { author: 'Alice <a@x>', date: '2024-01-02T00:00:00Z', files: { 'a.txt': 'v2\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });
  spawnSync('git', ['tag', 'v2', 'HEAD'], { cwd: dir });

  const result = await discover(dir, {
    ...defaultDiscoverOpts,
    range: { from: 'v1', to: 'v2' },
  });

  expect(result.headSha).toMatch(/^[0-9a-f]{40}$/);
  expect(result.range?.fromSha).toMatch(/^[0-9a-f]{40}$/);
  expect(result.range?.toSha).toBe(result.headSha);
  expect(result.range?.fromRef).toBe('v1');
  expect(result.range?.toRef).toBe('v2');
});
```

Define a `defaultDiscoverOpts` helper at the top of the describe block that has all the required fields (`includeGenerated: false, includeMinified: true, includeGlobs: [], excludeGlobs: []`).

- [ ] **Step 4: Implement the changes**

Update `discover` to check for `options.range` first, then `options.rev`, then default to HEAD.

- [ ] **Step 5: Run tests, lint**

Expected: all tests pass, lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/discover.ts src/internal/pipeline/discover.test.ts
git commit -m "Support rev and range resolution in discover phase"
```

---

## Task 3: Update `runLogPhase` with range and date args

**Files:**

- Modify: `src/internal/pipeline/run-log-phase.ts`
- Modify: `src/internal/pipeline/run-log-phase.test.ts`

`runLogPhase` currently runs `git log --no-merges --pretty=format:... --numstat` with no range or date filters. Add options for:

- `range?: { fromSha: string; toSha: string }` → appends `fromSha..toSha` to git log args
- `since?: Date` → appends `--since=<ISO>`
- `until?: Date` → appends `--until=<ISO>`

When no range is provided, git log runs against the full history (current behaviour).

- [ ] **Step 1: Read current file**

Read `src/internal/pipeline/run-log-phase.ts`.

- [ ] **Step 2: Expand `runLogPhase` signature**

```ts
export interface LogPhaseOptions {
  range?: { fromSha: string; toSha: string };
  since?: Date;
  until?: Date;
}

export const runLogPhase = async (
  cwd: string,
  aggregator: Aggregator,
  options?: LogPhaseOptions,
): Promise<void> => {
```

Build git args dynamically:

```ts
const args = ['log', '--no-merges', '--pretty=format:%H%x00%an%x00%ae%x00%at', '--numstat'];
if (options?.range) {
  args.push(`${options.range.fromSha}..${options.range.toSha}`);
}
if (options?.since) {
  args.push(`--since=${options.since.toISOString()}`);
}
if (options?.until) {
  args.push(`--until=${options.until.toISOString()}`);
}
```

- [ ] **Step 3: Update existing tests**

All existing calls `runLogPhase(dir, agg)` stay valid because `options` is optional. No changes needed.

- [ ] **Step 4: Add new tests**

```ts
it('filters commits by since date', async () => {
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'one\n' } },
    { author: 'Bob <b@x>', date: '2024-06-01T00:00:00Z', files: { 'b.txt': 'two\n' } },
  ]);
  createdRepos.push(dir);

  const agg = new Aggregator();
  await runLogPhase(dir, agg, { since: new Date('2024-03-01T00:00:00Z') });

  const stats = agg.getStatsForTesting();
  expect(stats.size).toBe(1);
  expect(stats.get('b@x')?.commits).toBe(1);
});

it('filters commits by range', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'one\n' } },
    { author: 'Bob <b@x>', date: '2024-01-02T00:00:00Z', files: { 'b.txt': 'two\n' } },
    { author: 'Charlie <c@x>', date: '2024-01-03T00:00:00Z', files: { 'c.txt': 'three\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~2'], { cwd: dir });
  spawnSync('git', ['tag', 'v2', 'HEAD~1'], { cwd: dir });

  const logResult = spawnSync('git', ['rev-parse', 'v1'], { cwd: dir, encoding: 'utf8' });
  const fromSha = logResult.stdout.trim();
  const logResult2 = spawnSync('git', ['rev-parse', 'v2'], { cwd: dir, encoding: 'utf8' });
  const toSha = logResult2.stdout.trim();

  const agg = new Aggregator();
  await runLogPhase(dir, agg, { range: { fromSha, toSha } });

  // Only Bob's commit (between v1 and v2) should be counted
  const stats = agg.getStatsForTesting();
  expect(stats.size).toBe(1);
  expect(stats.get('b@x')?.commits).toBe(1);
});
```

- [ ] **Step 5: Run tests, lint**

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/run-log-phase.ts src/internal/pipeline/run-log-phase.test.ts
git commit -m "Add range and date filter options to runLogPhase"
```

---

## Task 4: Update `runBlamePhase` to use resolved rev

**Files:**

- Modify: `src/internal/pipeline/run-blame-phase.ts`
- Modify: `src/internal/pipeline/run-blame-phase.test.ts`

Currently blame args hardcode `'HEAD'`. Add a `rev` field to `BlameOptions` (default `'HEAD'`). The resolved SHA from discover gets passed through.

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Add `rev` to `BlameOptions`**

```ts
export interface BlameOptions {
  rev: string; // NEW — resolved SHA to blame against
  followRenames: boolean;
  ignoreWhitespace: boolean;
}
```

Update `buildBlameArgs` to use `options.rev` instead of hardcoded `'HEAD'`.

- [ ] **Step 3: Update existing tests**

All existing calls to `runBlamePhase(dir, files, agg, { followRenames: true, ignoreWhitespace: true })` become `runBlamePhase(dir, files, agg, { rev: 'HEAD', followRenames: true, ignoreWhitespace: true })`.

- [ ] **Step 4: Add new test**

```ts
it('blames at a specific tag revision', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'v1 content\n' } },
    { author: 'Bob <b@x>', date: '2024-01-02T00:00:00Z', files: { 'a.txt': 'v2 content\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });

  const agg = new Aggregator();
  // Blame at v1 — only Alice's version exists
  await runBlamePhase(dir, ['a.txt'], agg, {
    rev: 'v1',
    followRenames: true,
    ignoreWhitespace: true,
  });

  const stats = agg.getStatsForTesting();
  expect(stats.get('a@x')?.linesAlive).toBe(1);
  expect(stats.get('b@x')).toBeUndefined();
});
```

- [ ] **Step 5: Run tests, lint**

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/run-blame-phase.ts src/internal/pipeline/run-blame-phase.test.ts
git commit -m "Use resolved rev in blame phase instead of hardcoded HEAD"
```

---

## Task 5: Update `assembleReport` to populate range

**Files:**

- Modify: `src/internal/pipeline/assemble-report.ts`
- Modify: `src/internal/pipeline/assemble-report.test.ts`

Expand `AssembleContext` with an optional `range` field. When present, it's copied into `Report.repo.range`.

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Expand `AssembleContext`**

```ts
export interface AssembleContext {
  path: string;
  headSha: string;
  headRef: string;
  range?: {
    fromSha: string;
    toSha: string;
    fromRef: string;
    toRef: string;
  };
  startedAt: Date;
  durationMs: number;
}
```

In `assembleReport`, pass `ctx.range` through to the repo object.

- [ ] **Step 3: Add test**

```ts
it('includes range in the report when provided', () => {
  const agg = new Aggregator();
  const report = assembleReport(agg, {
    path: '/tmp/repo',
    headSha: 'b'.repeat(40),
    headRef: 'v2',
    range: {
      fromSha: 'a'.repeat(40),
      toSha: 'b'.repeat(40),
      fromRef: 'v1',
      toRef: 'v2',
    },
    startedAt: new Date(0),
    durationMs: 0,
  });

  expect(report.repo.range).toStrictEqual({
    fromSha: 'a'.repeat(40),
    toSha: 'b'.repeat(40),
    fromRef: 'v1',
    toRef: 'v2',
  });
});
```

- [ ] **Step 4: Run tests, lint**

- [ ] **Step 5: Commit**

```bash
git add src/internal/pipeline/assemble-report.ts src/internal/pipeline/assemble-report.test.ts
git commit -m "Populate Report.repo.range in assembleReport"
```

---

## Task 6: Thread ref options through `analyze()` with conflict validation

**Files:**

- Modify: `src/analyze.ts`
- Modify: `src/analyze.test.ts`

`analyze()` validates that `rev` and `range` are not both set (`ConflictingOptionsError`). It threads the resolved rev/range through discover → log → blame → assemble.

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Update `analyze()`**

After `resolveDefaults`, add:

```ts
if (options.rev !== undefined && options.range !== undefined) {
  throw new ConflictingOptionsError("'rev' and 'range' are mutually exclusive");
}
```

Thread through phases:

- `discover(path, { ...discoverOpts, rev: options.rev, range: options.range })`
- `runLogPhase(path, aggregator, { range: discovered.range ? { fromSha: discovered.range.fromSha, toSha: discovered.range.toSha } : undefined, since: options.since, until: options.until })`
- `runBlamePhase(path, files, aggregator, { rev: discovered.headSha, ...blameOpts })`
- `assembleReport(aggregator, { ...ctx, range: discovered.range })`

- [ ] **Step 3: Add end-to-end tests**

```ts
it('throws ConflictingOptionsError when both rev and range are provided', async () => {
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hi\n' } },
  ]);
  createdRepos.push(dir);

  await expect(
    analyze({ path: dir, rev: 'HEAD', range: { from: 'HEAD~1', to: 'HEAD' } }),
  ).rejects.toBeInstanceOf(ConflictingOptionsError);
});

it('analyzes at a specific tag with --rev', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'v1 line\n' } },
    { author: 'Bob <b@x>', date: '2024-01-02T00:00:00Z', files: { 'a.txt': 'v2 line\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });

  const report = await analyze({ path: dir, rev: 'v1' });

  expect(report.repo.headRef).toBe('v1');
  // At v1, only Alice's commit exists
  const alice = report.authors.find((a) => a.email === 'a@x');
  expect(alice?.linesAlive).toBe(1);
  expect(report.authors.find((a) => a.email === 'b@x')?.linesAlive ?? 0).toBe(0);
});

it('counts only commits in range for linesAdded', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'alice\n' } },
    { author: 'Bob <b@x>', date: '2024-01-02T00:00:00Z', files: { 'b.txt': 'bob\n' } },
    { author: 'Charlie <c@x>', date: '2024-01-03T00:00:00Z', files: { 'c.txt': 'charlie\n' } },
  ]);
  createdRepos.push(dir);
  spawnSync('git', ['tag', 'v1', 'HEAD~2'], { cwd: dir });
  spawnSync('git', ['tag', 'v2', 'HEAD~1'], { cwd: dir });

  const report = await analyze({
    path: dir,
    range: { from: 'v1', to: 'v2' },
  });

  expect(report.repo.range?.fromRef).toBe('v1');
  expect(report.repo.range?.toRef).toBe('v2');
  // Log only counts Bob's commit (between v1..v2)
  const bob = report.authors.find((a) => a.email === 'b@x');
  expect(bob?.linesAdded).toBe(1);
  expect(bob?.commits).toBe(1);
  // Alice's commit is before the range — not in linesAdded
  const alice = report.authors.find((a) => a.email === 'a@x');
  expect(alice?.linesAdded ?? 0).toBe(0);
});

it('filters log by since date', async () => {
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'old\n' } },
    { author: 'Bob <b@x>', date: '2024-06-01T00:00:00Z', files: { 'b.txt': 'new\n' } },
  ]);
  createdRepos.push(dir);

  const report = await analyze({
    path: dir,
    since: new Date('2024-03-01T00:00:00Z'),
  });

  const bob = report.authors.find((a) => a.email === 'b@x');
  expect(bob?.commits).toBe(1);
  // Alice's commit is too old for the log filter
  const alice = report.authors.find((a) => a.email === 'a@x');
  expect(alice?.commits ?? 0).toBe(0);
  // But blame still shows all lines at HEAD — alice may still have linesAlive
});
```

- [ ] **Step 4: Run tests, lint**

- [ ] **Step 5: Commit**

```bash
git add src/analyze.ts src/analyze.test.ts
git commit -m "Validate ref conflicts and thread rev/range/date through analyze"
```

---

## Task 7: CLI flags for ref selection

**Files:**

- Modify: `cli/parse-flags.ts`
- Modify: `cli/parse-flags.test.ts`

Add 5 new commander options:

- `--rev <ref>` — single ref (string)
- `--from <ref>` — range start (maps to `range.from`)
- `--to <ref>` — range end (maps to `range.to`)
- `--since <date>` — date filter (parsed to `Date`)
- `--until <date>` — date filter (parsed to `Date`)

When `--from` and `--to` are both provided, construct `range: { from, to }`. When only one is provided, throw (or let `analyze()` handle it — simplest is to let the downstream validation catch it).

- [ ] **Step 1: Read current parse-flags.ts**

- [ ] **Step 2: Add the new options**

```ts
.option('--rev <ref>', 'Analyze at a specific commit, tag, or branch')
.option('--from <ref>', 'Start of commit range (used with --to)')
.option('--to <ref>', 'End of commit range (used with --from)')
.option('--since <date>', 'Only count log entries after this date (ISO 8601)')
.option('--until <date>', 'Only count log entries before this date (ISO 8601)')
```

Map to `AnalyzeOptions`:

```ts
rev: opts.rev as string | undefined,
range: opts.from && opts.to ? { from: opts.from as string, to: opts.to as string } : undefined,
since: opts.since ? new Date(opts.since as string) : undefined,
until: opts.until ? new Date(opts.until as string) : undefined,
```

- [ ] **Step 3: Add tests**

```ts
it('passes --rev as options.rev', () => {
  const { options } = parseFlags([...base, '--rev', 'v1.0', '/path']);
  expect(options.rev).toBe('v1.0');
});

it('builds range from --from and --to', () => {
  const { options } = parseFlags([...base, '--from', 'v1', '--to', 'v2', '/path']);
  expect(options.range).toEqual({ from: 'v1', to: 'v2' });
});

it('parses --since as a Date', () => {
  const { options } = parseFlags([...base, '--since', '2024-01-01']);
  expect(options.since).toBeInstanceOf(Date);
});

it('parses --until as a Date', () => {
  const { options } = parseFlags([...base, '--until', '2024-12-31']);
  expect(options.until).toBeInstanceOf(Date);
});

it('leaves range undefined when only --from is provided', () => {
  const { options } = parseFlags([...base, '--from', 'v1']);
  expect(options.range).toBeUndefined();
});
```

- [ ] **Step 4: Run tests, lint**

- [ ] **Step 5: Commit**

```bash
git add cli/parse-flags.ts cli/parse-flags.test.ts
git commit -m "Add rev, range, since, until CLI flags"
```

---

## Task 8: Dogfood verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
rm -rf dist && npm run build
```

- [ ] **Step 2: Run on node-fame repo at a specific commit**

Pick a commit SHA from earlier in the history (e.g. the M3 dogfood commit) and analyze it:

```bash
node dist/cli/bin.js --rev HEAD~10 .
```

Expected: numbers differ from HEAD analysis because newer commits aren't counted in blame.

- [ ] **Step 3: Run with --since on store repo**

```bash
node dist/cli/bin.js --since 2025-01-01 /Users/mike/work/store
```

Expected: only recent commits appear in linesAdded/commits columns. linesAlive reflects HEAD (blame is always at HEAD).

- [ ] **Step 4: Full test suite**

```bash
npm run lint
npm run test:run
```

Expected: all green.

- [ ] **Step 5: Verify commit history**

```bash
git log --oneline feat/initial ^main | head -10
```

Expected: ~7 new M5 commits.
