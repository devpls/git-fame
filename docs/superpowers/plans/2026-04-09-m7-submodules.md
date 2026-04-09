# M7 Submodules & Recursive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multi-repo analysis. After this plan, `node-fame --submodules .` merges submodule authors into the parent report, `node-fame --submodules --split-submodules .` prints separate reports per submodule, and `node-fame --recursive /path/to/workspace` analyzes sibling repos in a directory.

**Architecture:** A new `discoverSubmodules` helper reads `.gitmodules` via `git config`, checks initialisation status. `analyze()` gains `submodules` support: when on, it calls `analyze()` recursively on each initialised submodule and merges the result into the parent `Aggregator`. A new `analyzeMany()` function handles `splitSubmodules` and `recursive` by returning `Report[]` instead of a single `Report`. The CLI dispatches to `analyze` or `analyzeMany` based on flags.

**Tech Stack:** TypeScript 6, Node 20+, vitest 4. No new runtime dependencies.

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By. See `CLAUDE.md`.

**Context:** M6 complete (278 tests, 4 output formats, progress bar). `analyze()` processes a single repo. `isGitRepo()` checks for `.git` dir/file. Spec Section 1 says: submodules off by default; when on, uninitialised = warning + skip; never auto-init; merge by default, split via flag.

---

## File structure

### New files

| Path                                              | Responsibility                                         |
| ------------------------------------------------- | ------------------------------------------------------ |
| `src/internal/git/discover-submodules.ts`         | List submodules from `.gitmodules` + check init status |
| `src/internal/git/discover-submodules.test.ts`    | Tests                                                  |
| `src/analyze-many.ts`                             | `analyzeMany()` orchestrator                           |
| `src/analyze-many.test.ts`                        | Tests                                                  |
| `src/types/analyze-many-options.type.ts`          | Extends AnalyzeOptions                                 |
| `tests/helpers/build-repo-with-submodule.ts`      | Test helper: create repo + submodule fixture           |
| `tests/helpers/build-repo-with-submodule.test.ts` | Meta-test                                              |

### Modified files

| Path                                | What changes                                  |
| ----------------------------------- | --------------------------------------------- |
| `src/types/analyze-options.type.ts` | Add `submodules?: boolean`                    |
| `src/analyze.ts`                    | When submodules true, discover + merge        |
| `src/analyze.test.ts`               | Submodule merge tests                         |
| `src/internal/git/index.ts`         | Re-export discoverSubmodules                  |
| `src/index.ts`                      | Export analyzeMany, AnalyzeManyOptions        |
| `cli/parse-flags.ts`                | --submodules, --split-submodules, --recursive |
| `cli/parse-flags.test.ts`           | New tests                                     |
| `cli/bin.ts`                        | Dispatch analyze vs analyzeMany               |

---

## Task 1: `buildRepoWithSubmodule` test helper

**Files:**

- Create: `tests/helpers/build-repo-with-submodule.ts`
- Create: `tests/helpers/build-repo-with-submodule.test.ts`

Creates a parent repo containing an initialised git submodule. Uses `git submodule add` under the hood. Returns `{ parentDir, submoduleDir, submoduleName }`.

The helper creates two repos in a temp dir: a "library" repo and a "parent" repo. The library is added as a submodule named `lib` inside the parent via `git submodule add`.

Tests (2):

1. Creates a parent with `.gitmodules` and initialised submodule
2. Parent repo has its own tracked files (parent.txt)

TDD cycle, then commit: `Add buildRepoWithSubmodule test helper`

---

## Task 2: `discoverSubmodules` helper

**Files:**

- Create: `src/internal/git/discover-submodules.ts`
- Create: `src/internal/git/discover-submodules.test.ts`
- Modify: `src/internal/git/index.ts`

Lists submodules by running `git config -f .gitmodules --get-regexp '^submodule\..*\.path$'`. For each, checks initialisation via `isGitRepo(join(repoRoot, path))`. Returns `SubmoduleInfo[]`.

```ts
export interface SubmoduleInfo {
  name: string;
  path: string;
  initialized: boolean;
}
```

Tests (2):

1. Returns empty array for a repo with no submodules
2. Discovers an initialised submodule with correct path and name

Commit: `Add discoverSubmodules helper`

---

## Task 3: Expand types + `analyze()` submodule merge

**Files:**

- Modify: `src/types/analyze-options.type.ts` — add `submodules?: boolean`
- Create: `src/types/analyze-many-options.type.ts`
- Modify: `src/analyze.ts`
- Modify: `src/analyze.test.ts`
- Modify: `src/internal/identity/aggregator/aggregator.ts` — add `mergeAuthorStats` method

### AnalyzeOptions

Add: `submodules?: boolean` (default false)

### AnalyzeManyOptions

```ts
import type { AnalyzeOptions } from './analyze-options.type.js';

export interface AnalyzeManyOptions extends AnalyzeOptions {
  recursive?: boolean;
  splitSubmodules?: boolean;
}
```

### Aggregator.mergeAuthorStats

New method to merge stats from a sub-report's author:

```ts
mergeAuthorStats(author: AuthorStats): void {
  const stats = this.getOrCreate(author.name, author.email);
  stats.linesAlive += author.linesAlive;
  stats.linesAdded += author.linesAdded;
  stats.linesDeleted += author.linesDeleted;
  stats.commits += author.commits;
  // Approximate file merge: add the count (slightly over-counts cross-repo overlap,
  // but submodules have distinct paths so overlap is near-zero)
  for (let i = 0; i < author.files; i++) {
    stats.filesSet.add(`__sub__${author.email}__${String(stats.filesSet.size + i)}`);
  }
  const firstSec = Math.floor(author.firstCommit.getTime() / 1000);
  const lastSec = Math.floor(author.lastCommit.getTime() / 1000);
  if (stats.firstCommitTime === undefined || firstSec < stats.firstCommitTime) {
    stats.firstCommitTime = firstSec;
  }
  if (stats.lastCommitTime === undefined || lastSec > stats.lastCommitTime) {
    stats.lastCommitTime = lastSec;
  }
}
```

### analyze() submodule integration

After the main pipeline phases complete, if `options.submodules === true`:

```ts
const submodules = discoverSubmodules(options.path);
for (const sub of submodules) {
  if (!sub.initialized) {
    aggregator.recordWarning({
      code: 'UNINIT_SUBMODULE',
      path: sub.path,
      message: `${sub.path} is not initialized`,
    });
    continue;
  }
  const subReport = await analyze({
    ...options,
    path: join(options.path, sub.path),
    submodules: false,
  });
  for (const author of subReport.authors) {
    aggregator.mergeAuthorStats(author);
  }
  for (const warning of subReport.warnings) {
    aggregator.recordWarning(warning);
  }
}
```

### Tests (3)

1. "merges submodule stats when submodules is true" — buildRepoWithSubmodule, both parent + lib authors appear
2. "emits UNINIT_SUBMODULE warning for uninitialised submodules" — deinit after build, verify warning
3. "ignores submodules by default" — verify lib author absent when submodules not set

Commit: `Support submodule merge in analyze()`

---

## Task 4: `analyzeMany()` — split submodules + recursive

**Files:**

- Create: `src/analyze-many.ts`
- Create: `src/analyze-many.test.ts`

### analyzeMany(options: AnalyzeManyOptions): Promise<Report[]>

**Split submodules** (splitSubmodules + submodules both true):

1. Analyze parent (submodules: false)
2. discoverSubmodules
3. Analyze each initialised submodule separately
4. Return [parentReport, ...subReports]
5. Uninitialised -> warning in parent

**Recursive** (recursive: true):

1. Read subdirs of path
2. For each that passes isGitRepo, call analyze()
3. Return array

When neither flag: `[await analyze(options)]`

### Tests (3)

1. Returns array of reports for split submodules
2. Analyzes sibling repos in recursive mode — create workspace with 2 repos
3. Returns single-element array when no special flags

Commit: `Add analyzeMany with split submodules and recursive modes`

---

## Task 5: CLI flags + public exports

**Files:**

- Modify: `cli/parse-flags.ts`
- Modify: `cli/parse-flags.test.ts`
- Modify: `cli/bin.ts`
- Modify: `src/index.ts`

### Commander flags

```
--submodules            Walk into submodules
--split-submodules      Output separate reports per submodule (implies --submodules)
--recursive             Analyze all git repos in subdirectories
```

### bin.ts dispatch

When `splitSubmodules` or `recursive` is set, use `analyzeMany()` and print each report with a `=== path ===` header. Otherwise use `analyze()`.

### Public API exports

Add to `src/index.ts`:

```ts
export { analyzeMany } from './analyze-many.js';
export type { AnalyzeManyOptions } from './types/analyze-many-options.type.js';
```

### Tests (3 new in parse-flags)

1. --submodules sets submodules: true
2. --recursive sets recursive: true
3. --split-submodules sets splitSubmodules: true

Commit: `Add submodules recursive and split-submodules CLI flags`

---

## Task 6: Dogfood verification

**Files:** none

- [ ] **Step 1: Build**

```bash
rm -rf dist && npm run build
```

- [ ] **Step 2: Test --recursive on a local workspace**

```bash
node dist/cli/bin.js --recursive --limit 3 --format table /Users/mike/work
```

Expected: separate report sections for git repos under /Users/mike/work. Each prefixed with `=== path ===`.

- [ ] **Step 3: Lint + full test suite**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 4: Verify commit history**

```bash
git log --oneline feat/initial ^main | head -10
```
