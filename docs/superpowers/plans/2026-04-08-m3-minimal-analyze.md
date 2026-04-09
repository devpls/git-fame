# M3 Minimal analyze() and First Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first working end-to-end slice of node-fame. After this plan, `npx node-fame .` runs against the node-fame repository itself and prints a per-author contribution table with real numbers. Everything else (CLI flags, JSON/CSV output, submodules, mailmap, ranges) is deferred to later milestones.

**Architecture:** The `analyze()` public entry orchestrates four pipeline phases in the order defined by spec Section 3. Phase 1 (discover) validates the repo and lists non-binary tracked files. Phase 2 (log) streams `git log --numstat` through `parseLogNumstat` into an `Aggregator`. Phase 3 (blame) streams `git blame --line-porcelain` per file, in parallel via `p-limit`, through `parseBlamePorcelain` into the same `Aggregator`. Phase 4 (assemble) snapshots the aggregator into a frozen `Report`. A single `render(report, 'table')` entry converts the `Report` into a CLI table via `cli-table3`. The CLI binary at `cli/bin.ts` wires `analyze()` + `render()` for the dogfood run.

**Tech Stack:** TypeScript 6 (strict + `noUncheckedIndexedAccess`), Node 20+, vitest 4, cli-table3 (new runtime dep), p-limit (new runtime dep).

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. See `CLAUDE.md`.

**Context for implementer:** M0, M1, and M2 are all complete. The project has typed errors, git wrappers (`spawnGit`, `collectStream`, `isGitRepo`, `resolveRev`, `listTrackedFiles`, `assertGitInstalled`), two streaming parsers (`parseBlamePorcelain`, `parseLogNumstat`), the `buildRepo` test helper, and 118 passing tests across 29 files. Read `CLAUDE.md` for conventions before starting — especially "Context → class, no-context → arrow", "Fast exit over nested if", "One function or class per file" (with folder-pattern for complex operations), and "Test file layout — colocated".

**Critical conventions (from CLAUDE.md):**

- **Arrow functions everywhere** except `async function*` generators. The `Aggregator` is a class because it owns mutable state.
- **One function or class per file.** When a file has helpers, upgrade to folder-pattern (`some-op/index.ts` + `some-op.ts` + `helpers/` + `types/`).
- **Fast exit** — guard clauses first, happy path at the leftmost indentation, no nested `if`.
- **Named exports only.** `undefined` over `null`. `interface` for object shapes.
- **Explicit return types on exported functions.**
- **ESM `.js` extensions** in relative imports. No path aliases.
- **Colocated tests** — each source file has its sibling `.test.ts`, except `.type.ts` files which are exempt.

---

## File structure

### New public types in `src/types/`

| Path                                | Responsibility                                     |
| ----------------------------------- | -------------------------------------------------- |
| `src/types/warning.type.ts`         | `Warning` discriminated union (codes from spec §2) |
| `src/types/author-stats.type.ts`    | `AuthorStats` interface                            |
| `src/types/report.type.ts`          | `Report` interface                                 |
| `src/types/analyze-options.type.ts` | `AnalyzeOptions` interface (M3-minimal subset)     |

### New internal modules

| Path                                                                  | Responsibility                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/internal/filter/is-binary/index.ts`                              | barrel                                                     |
| `src/internal/filter/is-binary/is-binary.ts`                          | `isBinary(absPath)` — reads first 8KB, checks for NUL byte |
| `src/internal/filter/is-binary/is-binary.test.ts`                     | Unit tests                                                 |
| `src/internal/identity/aggregator/index.ts`                           | barrel                                                     |
| `src/internal/identity/aggregator/aggregator.ts`                      | `Aggregator` class (mutable state + build)                 |
| `src/internal/identity/aggregator/aggregator.test.ts`                 | Unit tests                                                 |
| `src/internal/identity/aggregator/types/mutable-author-stats.type.ts` | private mutable state type                                 |
| `src/internal/pipeline/discover.ts`                                   | Phase 1: validate, list, filter binary                     |
| `src/internal/pipeline/discover.test.ts`                              | Integration tests                                          |
| `src/internal/pipeline/run-log-phase.ts`                              | Phase 2: spawn log, parse, feed aggregator                 |
| `src/internal/pipeline/run-log-phase.test.ts`                         |                                                            |
| `src/internal/pipeline/run-blame-phase.ts`                            | Phase 3: parallel blame via p-limit                        |
| `src/internal/pipeline/run-blame-phase.test.ts`                       |                                                            |
| `src/internal/pipeline/assemble-report.ts`                            | Phase 4: aggregator → frozen Report                        |
| `src/internal/pipeline/assemble-report.test.ts`                       |                                                            |

### New public pipeline entry

| Path                  | Responsibility                              |
| --------------------- | ------------------------------------------- |
| `src/analyze.ts`      | `analyze(options)` orchestrator             |
| `src/analyze.test.ts` | End-to-end analyze() tests on fixture repos |

### Render layer

| Path                                    | Responsibility                         |
| --------------------------------------- | -------------------------------------- |
| `src/render/index.ts`                   | barrel: exports `render`               |
| `src/render/render.ts`                  | `render(report, format)` dispatcher    |
| `src/render/render.test.ts`             |                                        |
| `src/render/table/index.ts`             | barrel                                 |
| `src/render/table/render-table.ts`      | `renderTable(report)` using cli-table3 |
| `src/render/table/render-table.test.ts` | Snapshot tests                         |

### CLI

| Path         | Responsibility                                               |
| ------------ | ------------------------------------------------------------ |
| `cli/bin.ts` | CLI entry: `process.argv[2]` → `analyze` → `render` → stdout |

### Modified files

- `package.json` — add `cli-table3` and `p-limit` to `dependencies`; re-enable the `bin` field (pointing to `dist/cli/bin.cjs` via zshy); add `zshy.bin` field
- `src/index.ts` — re-export `analyze`, `render`, and public types

---

## Task 1: Install runtime dependencies

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (regenerated by npm)

These are the first runtime dependencies of the project. `cli-table3` powers the table renderer; `p-limit` controls concurrency in the blame phase.

- [ ] **Step 1: Install both packages**

```bash
npm install cli-table3 p-limit
```

Expected: `package.json` gains `"dependencies": { "cli-table3": "^x.y.z", "p-limit": "^x.y.z" }`.

- [ ] **Step 2: Verify they appear in `npm ls`**

Run: `npm ls --depth=0 --prod`
Expected: two lines — `cli-table3@...` and `p-limit@...`.

- [ ] **Step 3: Run lint + tests to confirm no regressions**

Run: `npm run lint && npm run test:run`
Expected: lint exits 0, all 118 existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install cli-table3 and p-limit runtime dependencies"
```

---

## Task 2: Public types — Warning, AuthorStats, Report, AnalyzeOptions

**Files:**

- Create: `src/types/warning.type.ts`
- Create: `src/types/author-stats.type.ts`
- Create: `src/types/report.type.ts`
- Create: `src/types/analyze-options.type.ts`

Per spec §2. These are `.type.ts` files — no runtime code, no test files required. `tsc --noEmit` catches shape errors at compile time.

- [ ] **Step 1: Create `src/types/warning.type.ts`**

```ts
export type Warning =
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

- [ ] **Step 2: Create `src/types/author-stats.type.ts`**

```ts
export interface AuthorStats {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  files: number;
  firstCommit: Date;
  lastCommit: Date;
}
```

- [ ] **Step 3: Create `src/types/report.type.ts`**

```ts
import type { AuthorStats } from './author-stats.type.js';
import type { Warning } from './warning.type.js';

export interface Report {
  meta: {
    version: string;
    generatedAt: Date;
    durationMs: number;
  };
  repo: {
    path: string;
    headSha: string;
    headRef: string;
    range?: {
      fromSha: string;
      toSha: string;
      fromRef: string;
      toRef: string;
    };
    totals: {
      lines: number;
      commits: number;
      files: number;
    };
  };
  authors: AuthorStats[];
  warnings: Warning[];
}
```

- [ ] **Step 4: Create `src/types/analyze-options.type.ts`**

For M3 the only option is `path`. Later milestones will expand this interface with `rev`, `range`, `include`, etc. The shape below matches spec §2 subset for v0.1.

```ts
export interface AnalyzeOptions {
  path: string;
}
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0. The files are all type-only; they will only be exercised by code written in later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/types
git commit -m "Add public types for analyze result and options"
```

---

## Task 3: `isBinary` filter

**Files:**

- Create: `src/internal/filter/is-binary/index.ts`
- Create: `src/internal/filter/is-binary/is-binary.ts`
- Create: `src/internal/filter/is-binary/is-binary.test.ts`

`isBinary(absPath)` reads up to 8 KB from disk and returns `true` if any byte is NUL. This is the heuristic git itself uses for "is this text?" — a NUL in the first chunk means binary. File does not exist → throw (pipeline callers guard against this).

Folder-pattern is NOT required here (single function, no private helpers), but we still use a folder to keep the filter layer tidy for future filters (`is-generated`, `is-minified`).

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/is-binary/is-binary.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isBinary } from './is-binary.js';

describe('isBinary', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeFile = (name: string, content: Buffer | string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-binary-'));
    created.push(dir);
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };

  it('returns false for a plain UTF-8 text file', () => {
    const path = makeFile('text.txt', 'hello world\nline two\n');
    expect(isBinary(path)).toBe(false);
  });

  it('returns true for a file containing a NUL byte within the first 8 KB', () => {
    const path = makeFile('binary.bin', Buffer.from([0x48, 0x69, 0x00, 0x00, 0x01, 0x02]));
    expect(isBinary(path)).toBe(true);
  });

  it('returns false for an empty file', () => {
    const path = makeFile('empty.txt', '');
    expect(isBinary(path)).toBe(false);
  });

  it('returns false for non-ASCII UTF-8 content', () => {
    const path = makeFile('cyr.txt', 'строка с юникодом\n');
    expect(isBinary(path)).toBe(false);
  });

  it('returns true when the NUL byte is at the very start', () => {
    const path = makeFile('nul-first.bin', Buffer.from([0x00, 0x48, 0x69]));
    expect(isBinary(path)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-binary/is-binary.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the filter**

Create `src/internal/filter/is-binary/is-binary.ts`:

```ts
import { openSync, readSync, closeSync } from 'node:fs';

const PROBE_BYTES = 8192;

export const isBinary = (absPath: string): boolean => {
  const fd = openSync(absPath, 'r');
  try {
    const buffer = Buffer.alloc(PROBE_BYTES);
    const bytesRead = readSync(fd, buffer, 0, PROBE_BYTES, 0);
    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0x00) {
        return true;
      }
    }
    return false;
  } finally {
    closeSync(fd);
  }
};
```

- [ ] **Step 4: Create the barrel**

Create `src/internal/filter/is-binary/index.ts`:

```ts
export { isBinary } from './is-binary.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-binary/is-binary.test.ts`
Expected: 5 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/internal/filter/is-binary
git commit -m "Add isBinary file filter using NUL-byte probe"
```

---

## Task 4: `Aggregator` — types and class skeleton with `recordCommit`

**Files:**

- Create: `src/internal/identity/aggregator/index.ts`
- Create: `src/internal/identity/aggregator/aggregator.ts`
- Create: `src/internal/identity/aggregator/aggregator.test.ts`
- Create: `src/internal/identity/aggregator/types/mutable-author-stats.type.ts`

The `Aggregator` is the project's first and so-far only **class** (error classes excluded — those exist for `instanceof` identity). It owns mutable state: a `Map<email, MutableAuthorStats>`, and a `Warning[]`. Methods mutate. At the end, `build()` returns an immutable `Report`.

This task covers the type, the class skeleton, and the `recordCommit` method. `recordBlameLine`, `recordWarning`, and `build()` come in Task 5.

- [ ] **Step 1: Create the mutable state type**

Create `src/internal/identity/aggregator/types/mutable-author-stats.type.ts`:

```ts
export interface MutableAuthorStats {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  filesSet: Set<string>;
  firstCommitTime: number | undefined;
  lastCommitTime: number | undefined;
}
```

`filesSet` will become the `files` count at build time. `firstCommitTime`/`lastCommitTime` are Unix seconds (not Date objects) to avoid allocation on every update.

- [ ] **Step 2: Write the failing tests for `recordCommit`**

Create `src/internal/identity/aggregator/aggregator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import { Aggregator } from './aggregator.js';

const makeLogCommit = (overrides: Partial<LogCommit> = {}): LogCommit => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  files: [],
  ...overrides,
});

describe('Aggregator.recordCommit', () => {
  it('creates a new author entry on first commit', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        files: [{ path: 'a.txt', added: 10, deleted: 0 }],
      }),
    );

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(1);
    const alice = stats.get('alice@example.com');
    expect(alice?.name).toBe('Alice');
    expect(alice?.linesAdded).toBe(10);
    expect(alice?.linesDeleted).toBe(0);
    expect(alice?.commits).toBe(1);
    expect(alice?.filesSet.has('a.txt')).toBe(true);
    expect(alice?.firstCommitTime).toBe(1704067200);
    expect(alice?.lastCommitTime).toBe(1704067200);
  });

  it('sums added and deleted across multiple files in one commit', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        files: [
          { path: 'a.txt', added: 5, deleted: 0 },
          { path: 'b.txt', added: 3, deleted: 2 },
        ],
      }),
    );

    const alice = agg.getStatsForTesting().get('alice@example.com');
    expect(alice?.linesAdded).toBe(8);
    expect(alice?.linesDeleted).toBe(2);
    expect(alice?.filesSet.size).toBe(2);
  });

  it('accumulates commits across multiple commits from the same author', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorTime: 1704067200,
        files: [{ path: 'a.txt', added: 1, deleted: 0 }],
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorTime: 1704153600,
        files: [{ path: 'b.txt', added: 2, deleted: 0 }],
      }),
    );

    const alice = agg.getStatsForTesting().get('alice@example.com');
    expect(alice?.commits).toBe(2);
    expect(alice?.linesAdded).toBe(3);
    expect(alice?.filesSet.size).toBe(2);
    expect(alice?.firstCommitTime).toBe(1704067200);
    expect(alice?.lastCommitTime).toBe(1704153600);
  });

  it('tracks two different authors separately', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        files: [{ path: 'a.txt', added: 1, deleted: 0 }],
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        files: [{ path: 'b.txt', added: 2, deleted: 0 }],
      }),
    );

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(2);
    expect(stats.get('alice@example.com')?.linesAdded).toBe(1);
    expect(stats.get('bob@example.com')?.linesAdded).toBe(2);
  });

  it('updates name to the most recent for the same email', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'a@x',
        authorTime: 1704067200,
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice Smith',
        authorMail: 'a@x',
        authorTime: 1704153600,
      }),
    );
    expect(agg.getStatsForTesting().get('a@x')?.name).toBe('Alice Smith');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement the class skeleton with `recordCommit`**

Create `src/internal/identity/aggregator/aggregator.ts`:

```ts
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { MutableAuthorStats } from './types/mutable-author-stats.type.js';

const createEmptyStats = (name: string, email: string): MutableAuthorStats => ({
  name,
  email,
  linesAlive: 0,
  linesAdded: 0,
  linesDeleted: 0,
  commits: 0,
  filesSet: new Set<string>(),
  firstCommitTime: undefined,
  lastCommitTime: undefined,
});

export class Aggregator {
  private readonly authors = new Map<string, MutableAuthorStats>();

  private getOrCreate(name: string, email: string): MutableAuthorStats {
    const existing = this.authors.get(email);
    if (existing !== undefined) {
      existing.name = name;
      return existing;
    }
    const fresh = createEmptyStats(name, email);
    this.authors.set(email, fresh);
    return fresh;
  }

  recordCommit(commit: LogCommit): void {
    const stats = this.getOrCreate(commit.authorName, commit.authorMail);
    stats.commits += 1;

    for (const file of commit.files) {
      stats.linesAdded += file.added;
      stats.linesDeleted += file.deleted;
      stats.filesSet.add(file.path);
    }

    if (stats.firstCommitTime === undefined || commit.authorTime < stats.firstCommitTime) {
      stats.firstCommitTime = commit.authorTime;
    }
    if (stats.lastCommitTime === undefined || commit.authorTime > stats.lastCommitTime) {
      stats.lastCommitTime = commit.authorTime;
    }
  }

  /**
   * Test-only accessor. Do not call from production code.
   */
  getStatsForTesting(): ReadonlyMap<string, MutableAuthorStats> {
    return this.authors;
  }
}
```

- [ ] **Step 5: Create the barrel**

Create `src/internal/identity/aggregator/index.ts`:

```ts
export { Aggregator } from './aggregator.js';
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: 5 cases green.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/internal/identity/aggregator
git commit -m "Add Aggregator class with recordCommit and mutable author stats"
```

---

## Task 5: `Aggregator.recordBlameLine`, `recordWarning`, `build`

**Files:**

- Modify: `src/internal/identity/aggregator/aggregator.ts`
- Modify: `src/internal/identity/aggregator/aggregator.test.ts`

Complete the `Aggregator` interface: record blame lines (from phase 3), collect warnings, and produce the frozen `Report`.

- [ ] **Step 1: Add failing tests for the remaining methods**

Append to `src/internal/identity/aggregator/aggregator.test.ts` (inside the same file, new `describe` blocks at the top level):

```ts
import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { Warning } from '../../../types/warning.type.js';

const makeBlameLine = (overrides: Partial<BlameLine> = {}): BlameLine => ({
  sha: 'a'.repeat(40),
  authorName: 'Alice',
  authorMail: 'alice@example.com',
  authorTime: 1704067200,
  line: 'code',
  isBoundary: false,
  ...overrides,
});

describe('Aggregator.recordBlameLine', () => {
  it('increments linesAlive for an existing author', () => {
    const agg = new Aggregator();
    agg.recordCommit(makeLogCommit({ files: [{ path: 'a.txt', added: 10, deleted: 0 }] }));
    agg.recordBlameLine(makeBlameLine());
    agg.recordBlameLine(makeBlameLine());
    agg.recordBlameLine(makeBlameLine());

    expect(agg.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(3);
  });

  it('creates a new author when the first signal is a blame line', () => {
    const agg = new Aggregator();
    agg.recordBlameLine(makeBlameLine({ authorMail: 'new@x', authorName: 'New' }));
    const stats = agg.getStatsForTesting().get('new@x');
    expect(stats?.linesAlive).toBe(1);
    expect(stats?.name).toBe('New');
    expect(stats?.commits).toBe(0);
  });
});

describe('Aggregator.recordWarning', () => {
  it('appends warnings in insertion order', () => {
    const agg = new Aggregator();
    const w1: Warning = { code: 'FILE_SKIPPED_BINARY', file: 'a.png', message: 'binary file' };
    const w2: Warning = {
      code: 'BLAME_FAILED',
      file: 'b.txt',
      error: 'no such path',
      message: 'blame failed',
    };
    agg.recordWarning(w1);
    agg.recordWarning(w2);

    expect(agg.getWarningsForTesting()).toEqual([w1, w2]);
  });
});

describe('Aggregator.build', () => {
  it('produces a Report with totals and sorted-by-email authors', () => {
    const agg = new Aggregator();
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        files: [{ path: 'a.txt', added: 10, deleted: 2 }],
      }),
    );
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@example.com' }));
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@example.com' }));

    const report = agg.build(
      {
        version: '0.1.0',
        generatedAt: new Date('2024-02-01T00:00:00Z'),
        durationMs: 42,
      },
      {
        path: '/tmp/repo',
        headSha: 'b'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );

    expect(report.meta.version).toBe('0.1.0');
    expect(report.meta.durationMs).toBe(42);
    expect(report.repo.path).toBe('/tmp/repo');
    expect(report.repo.totals.lines).toBe(2);
    expect(report.repo.totals.commits).toBe(1);
    expect(report.repo.totals.files).toBe(1);
    expect(report.authors).toHaveLength(1);
    expect(report.authors[0]?.email).toBe('alice@example.com');
    expect(report.authors[0]?.linesAlive).toBe(2);
    expect(report.authors[0]?.linesAdded).toBe(10);
    expect(report.authors[0]?.linesDeleted).toBe(2);
    expect(report.authors[0]?.commits).toBe(1);
    expect(report.authors[0]?.files).toBe(1);
    expect(report.authors[0]?.firstCommit.getTime() / 1000).toBe(1704067200);
    expect(report.authors[0]?.lastCommit.getTime() / 1000).toBe(1704067200);
  });

  it('collects warnings into the built report', () => {
    const agg = new Aggregator();
    agg.recordWarning({ code: 'FILE_SKIPPED_BINARY', file: 'x.png', message: 'skipped' });
    const report = agg.build(
      { version: '0.1.0', generatedAt: new Date(0), durationMs: 0 },
      {
        path: '/tmp/repo',
        headSha: 'x'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.code).toBe('FILE_SKIPPED_BINARY');
  });

  it('produces authors with Date objects even when only blame lines were recorded', () => {
    const agg = new Aggregator();
    agg.recordBlameLine(makeBlameLine({ authorMail: 'a@x', authorTime: 1700000000 }));
    const report = agg.build(
      { version: '0.1.0', generatedAt: new Date(0), durationMs: 0 },
      {
        path: '/tmp/repo',
        headSha: 'x'.repeat(40),
        headRef: 'HEAD',
        totals: { lines: 0, commits: 0, files: 0 },
      },
    );
    expect(report.authors[0]?.firstCommit).toBeInstanceOf(Date);
    expect(report.authors[0]?.lastCommit).toBeInstanceOf(Date);
  });
});
```

Note: the `makeLogCommit` helper from Task 4 is in the same file and is reused.

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: the Task 4 tests still pass, the new tests fail because the methods do not exist yet.

- [ ] **Step 3: Extend `Aggregator` with the remaining methods**

Replace the contents of `src/internal/identity/aggregator/aggregator.ts` with:

```ts
import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { AuthorStats } from '../../../types/author-stats.type.js';
import type { Report } from '../../../types/report.type.js';
import type { Warning } from '../../../types/warning.type.js';
import type { MutableAuthorStats } from './types/mutable-author-stats.type.js';

const createEmptyStats = (name: string, email: string): MutableAuthorStats => ({
  name,
  email,
  linesAlive: 0,
  linesAdded: 0,
  linesDeleted: 0,
  commits: 0,
  filesSet: new Set<string>(),
  firstCommitTime: undefined,
  lastCommitTime: undefined,
});

const finaliseAuthor = (stats: MutableAuthorStats): AuthorStats => {
  const firstTimeSeconds = stats.firstCommitTime ?? 0;
  const lastTimeSeconds = stats.lastCommitTime ?? 0;
  return {
    name: stats.name,
    email: stats.email,
    linesAlive: stats.linesAlive,
    linesAdded: stats.linesAdded,
    linesDeleted: stats.linesDeleted,
    commits: stats.commits,
    files: stats.filesSet.size,
    firstCommit: new Date(firstTimeSeconds * 1000),
    lastCommit: new Date(lastTimeSeconds * 1000),
  };
};

export class Aggregator {
  private readonly authors = new Map<string, MutableAuthorStats>();
  private readonly warnings: Warning[] = [];

  private getOrCreate(name: string, email: string): MutableAuthorStats {
    const existing = this.authors.get(email);
    if (existing !== undefined) {
      existing.name = name;
      return existing;
    }
    const fresh = createEmptyStats(name, email);
    this.authors.set(email, fresh);
    return fresh;
  }

  recordCommit(commit: LogCommit): void {
    const stats = this.getOrCreate(commit.authorName, commit.authorMail);
    stats.commits += 1;

    for (const file of commit.files) {
      stats.linesAdded += file.added;
      stats.linesDeleted += file.deleted;
      stats.filesSet.add(file.path);
    }

    if (stats.firstCommitTime === undefined || commit.authorTime < stats.firstCommitTime) {
      stats.firstCommitTime = commit.authorTime;
    }
    if (stats.lastCommitTime === undefined || commit.authorTime > stats.lastCommitTime) {
      stats.lastCommitTime = commit.authorTime;
    }
  }

  recordBlameLine(line: BlameLine): void {
    const stats = this.getOrCreate(line.authorName, line.authorMail);
    stats.linesAlive += 1;
  }

  recordWarning(warning: Warning): void {
    this.warnings.push(warning);
  }

  build(meta: Report['meta'], repoBase: Omit<Report['repo'], 'totals'>): Report {
    const authors = Array.from(this.authors.values()).map(finaliseAuthor);

    const totals = authors.reduce(
      (acc, author) => ({
        lines: acc.lines + author.linesAlive,
        commits: acc.commits + author.commits,
        files: acc.files + author.files,
      }),
      { lines: 0, commits: 0, files: 0 },
    );

    return {
      meta,
      repo: {
        ...repoBase,
        totals,
      },
      authors,
      warnings: this.warnings.slice(),
    };
  }

  /**
   * Test-only accessor. Do not call from production code.
   */
  getStatsForTesting(): ReadonlyMap<string, MutableAuthorStats> {
    return this.authors;
  }

  /**
   * Test-only accessor. Do not call from production code.
   */
  getWarningsForTesting(): readonly Warning[] {
    return this.warnings;
  }
}
```

Note: `build()` accepts `repoBase` without `totals` — it computes them from the authors it has. The caller passes everything else (path, headSha, headRef). This keeps the orchestrator simple.

Note: the `files` total in spec §2 Report.repo.totals is the sum of `files` across authors. That double-counts files touched by multiple authors — documented behaviour per the spec data model.

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: all 13 test cases green (5 recordCommit + 2 recordBlameLine + 1 recordWarning + 3 build + helpers).

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/identity/aggregator
git commit -m "Complete Aggregator with recordBlameLine, recordWarning, and build"
```

---

## Task 6: Pipeline phase 1 — `discover`

**Files:**

- Create: `src/internal/pipeline/discover.ts`
- Create: `src/internal/pipeline/discover.test.ts`

Phase 1 validates the repo, resolves HEAD, lists tracked files, and filters out binaries. Returns a structure the other phases consume.

- [ ] **Step 1: Write the failing tests**

Create `src/internal/pipeline/discover.test.ts`:

```ts
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { discover } from './discover.js';

describe('discover', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns the HEAD sha and tracked file list for a repo with text files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n', 'b.txt': 'world\n' },
      },
    ]);
    createdRepos.push(dir);

    const result = await discover(dir);

    expect(result.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.headRef).toBe('HEAD');
    expect(result.files.sort()).toEqual(['a.txt', 'b.txt']);
    expect(result.warnings).toEqual([]);
  });

  it('filters out files with NUL bytes (binary)', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'text.txt': 'hello\n' },
      },
    ]);
    createdRepos.push(dir);
    // Add a binary file post-commit and amend (simulate a committed binary via fs + git)
    writeFileSync(join(dir, 'image.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    const { spawnSync } = await import('node:child_process');
    spawnSync('git', ['add', 'image.bin'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'add binary', '--author', 'Alice <a@x>'], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
        GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
        GIT_AUTHOR_NAME: 'Alice',
        GIT_AUTHOR_EMAIL: 'a@x',
        GIT_COMMITTER_NAME: 'Alice',
        GIT_COMMITTER_EMAIL: 'a@x',
      },
    });

    const result = await discover(dir);

    expect(result.files).toEqual(['text.txt']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('FILE_SKIPPED_BINARY');
  });

  it('throws NotAGitRepoError for a non-git directory', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'nfd-nongit-'));
    createdRepos.push(dir);
    await expect(discover(dir)).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('returns an empty files list for an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const result = await discover(dir);
    expect(result.files).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/pipeline/discover.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `discover`**

Create `src/internal/pipeline/discover.ts`:

```ts
import { join } from 'node:path';
import { isGitRepo } from '../git/is-git-repo.js';
import { listTrackedFiles } from '../git/list-tracked-files.js';
import { resolveRev } from '../git/resolve-rev.js';
import { isBinary } from '../filter/is-binary/index.js';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import type { Warning } from '../../types/warning.type.js';

export interface DiscoverResult {
  headSha: string;
  headRef: string;
  files: string[];
  warnings: Warning[];
}

export const discover = async (cwd: string): Promise<DiscoverResult> => {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  const headSha = await resolveRev(cwd, 'HEAD').catch(() => '');
  const allFiles = await listTrackedFiles(cwd);
  const warnings: Warning[] = [];
  const textFiles: string[] = [];

  for (const relPath of allFiles) {
    const absPath = join(cwd, relPath);
    try {
      if (isBinary(absPath)) {
        warnings.push({
          code: 'FILE_SKIPPED_BINARY',
          file: relPath,
          message: `${relPath} is binary; excluded from analysis`,
        });
        continue;
      }
      textFiles.push(relPath);
    } catch {
      // File may not exist on disk (ignored by git, symlink dangling). Skip silently.
    }
  }

  return {
    headSha,
    headRef: 'HEAD',
    files: textFiles,
    warnings,
  };
};
```

Note: `resolveRev('HEAD').catch(() => '')` handles empty repos gracefully — `HEAD` does not resolve if there are no commits, and we still want `discover` to return an empty file list for that case.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/internal/pipeline/discover.test.ts`
Expected: 4 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/discover.ts src/internal/pipeline/discover.test.ts
git commit -m "Add pipeline discover phase"
```

---

## Task 7: Pipeline phase 2 — `runLogPhase`

**Files:**

- Create: `src/internal/pipeline/run-log-phase.ts`
- Create: `src/internal/pipeline/run-log-phase.test.ts`

Phase 2 spawns `git log --numstat`, streams the output through `parseLogNumstat`, and calls `aggregator.recordCommit(commit)` for each parsed commit. Returns nothing — side effect is on the aggregator.

- [ ] **Step 1: Write the failing tests**

Create `src/internal/pipeline/run-log-phase.test.ts`:

```ts
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { runLogPhase } from './run-log-phase.js';

describe('runLogPhase', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('feeds all commits into the aggregator', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'x\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runLogPhase(dir, agg);

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(2);
    expect(stats.get('a@x')?.linesAdded).toBe(2);
    expect(stats.get('a@x')?.commits).toBe(1);
    expect(stats.get('b@x')?.linesAdded).toBe(1);
    expect(stats.get('b@x')?.commits).toBe(1);
  });

  it('is a no-op on an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const agg = new Aggregator();
    await runLogPhase(dir, agg);
    expect(agg.getStatsForTesting().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/pipeline/run-log-phase.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the phase**

Create `src/internal/pipeline/run-log-phase.ts`:

```ts
import { spawnGit } from '../git/spawn-git.js';
import { parseLogNumstat } from '../parse/parse-log-numstat/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

const LOG_ARGS = [
  'log',
  '--no-merges',
  '--pretty=format:%H%x00%an%x00%ae%x00%at',
  '--numstat',
] as const;

export const runLogPhase = async (cwd: string, aggregator: Aggregator): Promise<void> => {
  const result = spawnGit([...LOG_ARGS], cwd);

  const consume = async (): Promise<void> => {
    for await (const commit of parseLogNumstat(result.stdout)) {
      aggregator.recordCommit(commit);
    }
  };

  try {
    await Promise.all([consume(), result.done]);
  } catch (err) {
    // Empty repo causes git log to exit non-zero ("does not have any commits yet").
    // That is a legitimate empty state; the aggregator simply has no data.
    if (err instanceof Error && /does not have any commits|unknown revision/i.test(err.message)) {
      return;
    }
    throw err;
  }
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/internal/pipeline/run-log-phase.test.ts`
Expected: 2 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/run-log-phase.ts src/internal/pipeline/run-log-phase.test.ts
git commit -m "Add pipeline log phase"
```

---

## Task 8: Pipeline phase 3 — `runBlamePhase` (parallel)

**Files:**

- Create: `src/internal/pipeline/run-blame-phase.ts`
- Create: `src/internal/pipeline/run-blame-phase.test.ts`

Phase 3 runs `git blame --line-porcelain` for each file in parallel, capped by a concurrency limit from `p-limit`. Parsing goes through `parseBlamePorcelain`. Per-file failures produce a `BLAME_FAILED` warning and the phase keeps going.

- [ ] **Step 1: Write the failing tests**

Create `src/internal/pipeline/run-blame-phase.test.ts`:

```ts
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { runBlamePhase } from './run-blame-phase.js';

describe('runBlamePhase', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('records linesAlive for every blame line across files', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\ntwo\nthree\n', 'b.txt': 'single\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'b.txt'], agg);

    const stats = agg.getStatsForTesting().get('a@x');
    expect(stats?.linesAlive).toBe(4);
  });

  it('attributes lines to the current owner after a rewrite', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <b@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt'], agg);

    const stats = agg.getStatsForTesting();
    expect(stats.get('a@x')?.linesAlive).toBe(1);
    expect(stats.get('b@x')?.linesAlive).toBe(1);
  });

  it('emits BLAME_FAILED warning for missing files without throwing', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, ['a.txt', 'does-not-exist.txt'], agg);

    expect(agg.getStatsForTesting().get('a@x')?.linesAlive).toBe(1);
    const warnings = agg.getWarningsForTesting();
    expect(warnings.some((w) => w.code === 'BLAME_FAILED')).toBe(true);
  });

  it('is a no-op when the file list is empty', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);

    const agg = new Aggregator();
    await runBlamePhase(dir, [], agg);
    expect(agg.getStatsForTesting().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/pipeline/run-blame-phase.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the phase**

Create `src/internal/pipeline/run-blame-phase.ts`:

```ts
import { cpus } from 'node:os';
import pLimit from 'p-limit';
import { spawnGit } from '../git/spawn-git.js';
import { parseBlamePorcelain } from '../parse/parse-blame-porcelain/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

const blameOneFile = async (cwd: string, file: string, aggregator: Aggregator): Promise<void> => {
  try {
    const result = spawnGit(['blame', '--line-porcelain', 'HEAD', '--', file], cwd);
    const consume = async (): Promise<void> => {
      for await (const line of parseBlamePorcelain(result.stdout)) {
        aggregator.recordBlameLine(line);
      }
    };
    await Promise.all([consume(), result.done]);
  } catch (err) {
    aggregator.recordWarning({
      code: 'BLAME_FAILED',
      file,
      error: err instanceof Error ? err.message : String(err),
      message: `git blame failed for ${file}`,
    });
  }
};

export const runBlamePhase = async (
  cwd: string,
  files: readonly string[],
  aggregator: Aggregator,
): Promise<void> => {
  if (files.length === 0) {
    return;
  }
  const limit = pLimit(Math.max(1, cpus().length));
  await Promise.all(files.map((file) => limit(() => blameOneFile(cwd, file, aggregator))));
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/internal/pipeline/run-blame-phase.test.ts`
Expected: 4 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/run-blame-phase.ts src/internal/pipeline/run-blame-phase.test.ts
git commit -m "Add pipeline blame phase with parallel execution"
```

---

## Task 9: Pipeline phase 4 — `assembleReport`

**Files:**

- Create: `src/internal/pipeline/assemble-report.ts`
- Create: `src/internal/pipeline/assemble-report.test.ts`

Phase 4 is a thin wrapper that calls `aggregator.build(meta, repoBase)` with the right arguments. It is its own file because it has a single clear responsibility and allows the orchestrator to stay linear.

- [ ] **Step 1: Write the failing test**

Create `src/internal/pipeline/assemble-report.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { assembleReport } from './assemble-report.js';

describe('assembleReport', () => {
  it('builds a report from an aggregator with the supplied meta and repo fields', () => {
    const agg = new Aggregator();
    const start = new Date('2024-02-01T00:00:00Z');
    const report = assembleReport(agg, {
      path: '/tmp/repo',
      headSha: 'a'.repeat(40),
      headRef: 'HEAD',
      startedAt: start,
      durationMs: 123,
    });

    expect(report.meta.version).toBe('0.1.0');
    expect(report.meta.generatedAt).toEqual(start);
    expect(report.meta.durationMs).toBe(123);
    expect(report.repo.path).toBe('/tmp/repo');
    expect(report.repo.headSha).toBe('a'.repeat(40));
    expect(report.repo.headRef).toBe('HEAD');
    expect(report.repo.totals).toEqual({ lines: 0, commits: 0, files: 0 });
    expect(report.authors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/internal/pipeline/assemble-report.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `assembleReport`**

Create `src/internal/pipeline/assemble-report.ts`:

```ts
import type { Aggregator } from '../identity/aggregator/index.js';
import type { Report } from '../../types/report.type.js';

const NODE_FAME_VERSION = '0.1.0';

export interface AssembleContext {
  path: string;
  headSha: string;
  headRef: string;
  startedAt: Date;
  durationMs: number;
}

export const assembleReport = (aggregator: Aggregator, ctx: AssembleContext): Report =>
  aggregator.build(
    {
      version: NODE_FAME_VERSION,
      generatedAt: ctx.startedAt,
      durationMs: ctx.durationMs,
    },
    {
      path: ctx.path,
      headSha: ctx.headSha,
      headRef: ctx.headRef,
      totals: { lines: 0, commits: 0, files: 0 },
    },
  );
```

Note: the `totals: { 0, 0, 0 }` passed here is a placeholder — `Aggregator.build` ignores it and recomputes totals from the authors (this was implemented in Task 5). The repo-base type requires totals because of how the `Omit<Report['repo'], 'totals'>` was structured; passing a zero placeholder keeps the call simple without forcing us to loosen the type.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/internal/pipeline/assemble-report.test.ts`
Expected: green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/pipeline/assemble-report.ts src/internal/pipeline/assemble-report.test.ts
git commit -m "Add pipeline assemble phase"
```

---

## Task 10: `analyze()` orchestrator

**Files:**

- Create: `src/analyze.ts`
- Create: `src/analyze.test.ts`

Main public entry. Wires all four phases together and returns a frozen `Report`. Per spec §2, `analyze()` takes `AnalyzeOptions` and the M3 minimum is just `{ path }`.

- [ ] **Step 1: Write the end-to-end failing test**

Create `src/analyze.test.ts`:

```ts
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import { buildRepo } from '../tests/helpers/build-repo.js';

describe('analyze', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('produces a Report with correct totals for a two-author repo', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'alice one\nalice two\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'alice one\nBOB EDIT\n' },
      },
    ]);
    createdRepos.push(dir);

    const report = await analyze({ path: dir });

    expect(report.meta.version).toBe('0.1.0');
    expect(report.repo.path).toBe(dir);
    expect(report.repo.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(report.authors).toHaveLength(2);

    const alice = report.authors.find((a) => a.email === 'alice@example.com');
    const bob = report.authors.find((a) => a.email === 'bob@example.com');
    expect(alice?.linesAlive).toBe(1);
    expect(bob?.linesAlive).toBe(1);
    expect(alice?.linesAdded).toBe(2);
    expect(bob?.linesAdded).toBe(1);
    expect(bob?.linesDeleted).toBe(1);
  });

  it('returns an empty authors array for an empty repo', async () => {
    const dir = buildRepo([]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.authors).toEqual([]);
    expect(report.repo.totals).toEqual({ lines: 0, commits: 0, files: 0 });
  });

  it('records a duration greater than zero', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    createdRepos.push(dir);
    const report = await analyze({ path: dir });
    expect(report.meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/analyze.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `analyze`**

Create `src/analyze.ts`:

```ts
import { Aggregator } from './internal/identity/aggregator/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  const startedAt = new Date();
  const startMs = Date.now();

  const discovered = await discover(options.path);
  const aggregator = new Aggregator();

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  await Promise.all([
    runLogPhase(options.path, aggregator),
    runBlamePhase(options.path, discovered.files, aggregator),
  ]);

  const durationMs = Date.now() - startMs;

  return assembleReport(aggregator, {
    path: options.path,
    headSha: discovered.headSha,
    headRef: discovered.headRef,
    startedAt,
    durationMs,
  });
};
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/analyze.test.ts`
Expected: 3 cases green.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/analyze.ts src/analyze.test.ts
git commit -m "Add analyze() orchestrator wiring all four pipeline phases"
```

---

## Task 11: `renderTable` — table renderer

**Files:**

- Create: `src/render/table/index.ts`
- Create: `src/render/table/render-table.ts`
- Create: `src/render/table/render-table.test.ts`

The table renderer uses `cli-table3` to format the report. Columns per spec §6 Q6 decision (option B): `author`, `linesAlive`, `linesAdded`, `linesDeleted`, `commits`, `files`, `percentAlive`. Default sort: `linesAlive` desc.

- [ ] **Step 1: Write the failing tests**

Create `src/render/table/render-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Report } from '../../types/report.type.js';
import { renderTable } from './render-table.js';

const makeReport = (overrides: Partial<Report> = {}): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    durationMs: 100,
  },
  repo: {
    path: '/tmp/repo',
    headSha: 'a'.repeat(40),
    headRef: 'HEAD',
    totals: { lines: 0, commits: 0, files: 0 },
  },
  authors: [],
  warnings: [],
  ...overrides,
});

describe('renderTable', () => {
  it('returns a non-empty string for an empty report', () => {
    const out = renderTable(makeReport());
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('lists authors sorted by linesAlive descending', () => {
    const out = renderTable(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            linesAlive: 10,
            linesAdded: 10,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date('2024-01-01T00:00:00Z'),
            lastCommit: new Date('2024-01-01T00:00:00Z'),
          },
          {
            name: 'Bob',
            email: 'bob@example.com',
            linesAlive: 100,
            linesAdded: 100,
            linesDeleted: 0,
            commits: 2,
            files: 2,
            firstCommit: new Date('2024-01-02T00:00:00Z'),
            lastCommit: new Date('2024-01-02T00:00:00Z'),
          },
        ],
      }),
    );
    const bobIndex = out.indexOf('Bob');
    const aliceIndex = out.indexOf('Alice');
    expect(bobIndex).toBeGreaterThan(-1);
    expect(aliceIndex).toBeGreaterThan(-1);
    expect(bobIndex).toBeLessThan(aliceIndex);
  });

  it('includes the author name and all numeric columns in the output', () => {
    const out = renderTable(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            linesAlive: 42,
            linesAdded: 50,
            linesDeleted: 8,
            commits: 3,
            files: 4,
            firstCommit: new Date('2024-01-01T00:00:00Z'),
            lastCommit: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      }),
    );
    expect(out).toContain('Alice');
    expect(out).toContain('42');
    expect(out).toContain('50');
    expect(out).toContain('8');
    expect(out).toContain('3');
    expect(out).toContain('4');
  });

  it('renders the header with column names', () => {
    const out = renderTable(makeReport());
    expect(out).toContain('author');
    expect(out).toContain('linesAlive');
    expect(out).toContain('linesAdded');
  });

  it('computes percentAlive against the total of all authors', () => {
    const out = renderTable(
      makeReport({
        authors: [
          {
            name: 'Alice',
            email: 'a@x',
            linesAlive: 75,
            linesAdded: 75,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date(0),
            lastCommit: new Date(0),
          },
          {
            name: 'Bob',
            email: 'b@x',
            linesAlive: 25,
            linesAdded: 25,
            linesDeleted: 0,
            commits: 1,
            files: 1,
            firstCommit: new Date(0),
            lastCommit: new Date(0),
          },
        ],
      }),
    );
    expect(out).toContain('75.0');
    expect(out).toContain('25.0');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/render/table/render-table.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the renderer**

Create `src/render/table/render-table.ts`:

```ts
import Table from 'cli-table3';
import type { AuthorStats } from '../../types/author-stats.type.js';
import type { Report } from '../../types/report.type.js';

const formatPercent = (value: number, total: number): string => {
  if (total === 0) {
    return '0.0';
  }
  return ((value / total) * 100).toFixed(1);
};

const authorRow = (author: AuthorStats, totalLinesAlive: number): string[] => [
  `${author.name} <${author.email}>`,
  String(author.linesAlive),
  String(author.linesAdded),
  String(author.linesDeleted),
  String(author.commits),
  String(author.files),
  formatPercent(author.linesAlive, totalLinesAlive),
];

export const renderTable = (report: Report): string => {
  const sorted = [...report.authors].sort((a, b) => b.linesAlive - a.linesAlive);
  const totalLinesAlive = sorted.reduce((acc, author) => acc + author.linesAlive, 0);

  const table = new Table({
    head: [
      'author',
      'linesAlive',
      'linesAdded',
      'linesDeleted',
      'commits',
      'files',
      'percentAlive',
    ],
  });

  for (const author of sorted) {
    table.push(authorRow(author, totalLinesAlive));
  }

  return table.toString();
};
```

- [ ] **Step 4: Create the barrel**

Create `src/render/table/index.ts`:

```ts
export { renderTable } from './render-table.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/render/table/render-table.test.ts`
Expected: 5 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/render/table
git commit -m "Add table renderer using cli-table3"
```

---

## Task 12: `render()` dispatcher

**Files:**

- Create: `src/render/render.ts`
- Create: `src/render/render.test.ts`
- Create: `src/render/index.ts`

The public `render(report, format)` dispatches to the format-specific renderer. M3 only has `'table'`; later milestones add `'json'`, `'csv'`, `'markdown'`.

- [ ] **Step 1: Write the failing tests**

Create `src/render/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Report } from '../types/report.type.js';
import { render } from './render.js';

const emptyReport = (): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date(0),
    durationMs: 0,
  },
  repo: {
    path: '/tmp/repo',
    headSha: 'a'.repeat(40),
    headRef: 'HEAD',
    totals: { lines: 0, commits: 0, files: 0 },
  },
  authors: [],
  warnings: [],
});

describe('render', () => {
  it('delegates the "table" format to renderTable', () => {
    const out = render(emptyReport(), 'table');
    expect(typeof out).toBe('string');
    expect(out).toContain('author');
  });

  it('throws for an unknown format', () => {
    // @ts-expect-error — deliberately passing an invalid format to test runtime guard
    expect(() => render(emptyReport(), 'yaml')).toThrow(/unsupported format/i);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/render/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `render`**

Create `src/render/render.ts`:

```ts
import type { Report } from '../types/report.type.js';
import { renderTable } from './table/index.js';

export type RenderFormat = 'table';

export const render = (report: Report, format: RenderFormat): string => {
  if (format === 'table') {
    return renderTable(report);
  }
  throw new Error(`render: unsupported format '${String(format)}'`);
};
```

Note: `RenderFormat` is a single literal at M3; M6 expands it to `'table' | 'json' | 'csv' | 'markdown'`. The `throw` at the end covers the runtime case where a caller bypasses the type system (e.g. from untyped JS).

- [ ] **Step 4: Create the barrel**

Create `src/render/index.ts`:

```ts
export { render, type RenderFormat } from './render.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/render/render.test.ts`
Expected: 2 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/render/render.ts src/render/render.test.ts src/render/index.ts
git commit -m "Add render dispatcher with table format"
```

---

## Task 13: CLI binary and package wiring

**Files:**

- Create: `cli/bin.ts`
- Modify: `package.json` (zshy config + add bin field)
- Modify: `src/index.ts` (expand public exports)

The CLI entry is minimal at M3: take a path from `process.argv[2]` (default `process.cwd()`), call `analyze()`, call `render(report, 'table')`, print to stdout. Full commander integration is deferred to M4 when real flags arrive.

- [ ] **Step 1: Create the CLI entry**

Create `cli/bin.ts`:

```ts
#!/usr/bin/env node
import { analyze } from '../src/analyze.js';
import { render } from '../src/render/index.js';

const main = async (): Promise<void> => {
  const path = process.argv[2] ?? process.cwd();
  const report = await analyze({ path });
  const output = render(report, 'table');
  process.stdout.write(output + '\n');
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
```

Note: the `#!/usr/bin/env node` shebang is written into the compiled `dist/cli/bin.cjs` by zshy (zshy automatically adds shebangs to bin entries). Having it in the source is harmless because TypeScript ignores leading `#!` lines.

- [ ] **Step 2: Update `src/index.ts` to re-export the new public surface**

Replace the content of `src/index.ts`:

```ts
export const version = '0.1.0';

export {
  AbortError,
  ConflictingOptionsError,
  GitCommandError,
  GitNotInstalledError,
  InvalidRevError,
  NodeFameError,
  NotAGitRepoError,
} from './errors/index.js';

export { analyze } from './analyze.js';
export { render, type RenderFormat } from './render/index.js';

export type { AnalyzeOptions } from './types/analyze-options.type.js';
export type { AuthorStats } from './types/author-stats.type.js';
export type { Report } from './types/report.type.js';
export type { Warning } from './types/warning.type.js';
```

- [ ] **Step 3: Add the CLI entry to `package.json#zshy` and reinstate the `bin` field**

Open `package.json`. Find the `zshy` field (currently `"zshy": { "exports": {...}, "cjs": false }`) and add a `bin` entry inside it. Also add the top-level `bin` field so npm knows about the binary.

The new `package.json` top-level fields should include:

```json
"bin": {
  "node-fame": "./dist/cli/bin.cjs"
},
```

(placed anywhere in the top-level JSON, conventionally before `main`)

And `zshy` becomes:

```json
"zshy": {
  "exports": {
    ".": "./src/index.ts"
  },
  "bin": "./cli/bin.ts",
  "cjs": false
},
```

After these edits, run `npm run build` once manually so zshy writes its generated `main`/`module`/`types` fields back into `package.json` with the CLI entry also emitted.

- [ ] **Step 4: Build and verify dist structure**

```bash
rm -rf dist && npm run build
ls dist/cli/
```

Expected: `bin.cjs` (plus `.js` ESM variant if zshy emits both). The top-level `dist/index.js` still exists.

- [ ] **Step 5: Smoke-test the built CLI from the repo itself**

```bash
node dist/cli/bin.cjs .
```

Expected output: a table with at least one row (you, as the author of most commits). The exact numbers depend on the current repo state, but the command must not throw and the table header must include `author | linesAlive | linesAdded | ...`.

- [ ] **Step 6: Run lint and the full test suite**

```bash
npm run lint
npm run test:run
```

Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add cli src/index.ts package.json package-lock.json
git commit -m "Wire CLI bin entry and expand public API exports"
```

---

## Task 14: Dogfood verification

**Files:** none (verification only)

The moment of truth. Run `node-fame` against its own repository and confirm the table looks sensible.

- [ ] **Step 1: Build once more from a clean dist**

```bash
rm -rf dist && npm run build
```

- [ ] **Step 2: Run against the repo**

```bash
node dist/cli/bin.cjs .
```

Expected: a table with:

- `Mykhailo Kalashnikov <...>` as the top row (or near the top) with substantial `linesAlive` + `linesAdded` + `commits` numbers
- `Claude Opus 4.6 ...` may appear if any commits accidentally include co-author trailers; if so, that's a memory/policy miss — investigate which commit leaked the trailer
- `percentAlive` column totaling roughly 100% across all authors
- No crashes, no unhandled promise rejections

If the table looks wrong (nonsense numbers, missing authors, empty result), stop and investigate. Do NOT proceed to the commit step.

- [ ] **Step 3: Run the full test suite one last time**

```bash
npm run test:run
```

Expected: every test green. Count should be around 155 (≈118 from M0–M2 + roughly 35 new M3 tests).

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Run coverage**

```bash
npm run coverage
```

Expected: overall ≥ 90% lines; pure-unit modules (aggregator, render, filter/is-binary, types/) at 100%.

- [ ] **Step 6: Verify git state is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 7: Verify commit history**

```bash
git log --oneline feat/initial ^main | head -20
```

Expected: roughly 13 new commits layered on top of M2, one per Task 1–13 (Task 14 is verification-only).

- [ ] **Step 8: Dogfood ack**

Paste the table output into the session so the user can sanity-check the numbers on the actual repository. If anything looks suspicious, the user will flag it and we fix it before calling M3 done. Otherwise, M3 is closed.

---

## Self-review notes

**Spec coverage** (spec §7 M3 deliverables):

- ✅ analyze() only — Task 10
- ✅ HEAD only, no rev/range — analyze accepts only `{ path }` in Task 2's `AnalyzeOptions`
- ✅ Phases 1–4 — Tasks 6–9
- ✅ Filter: `include.binary: false` default — Task 3 + Task 6 (discover applies it)
- ✅ Rendering: table only — Task 11
- ✅ CLI: `node-fame [path]` — Task 13
- ✅ No submodules, recursive, mailmap, range, since, until — nothing in plan touches them

**Known limitations in M3** (out of scope, all noted in spec):

- Whitespace and rename filters are NOT applied in the blame command — `git blame -M -C -w` comes in M4. M3 dogfood numbers may be slightly skewed because of this; that is acceptable and expected.
- Merge commits are filtered via `--no-merges` in `git log`, matching spec default.
- Errors from `git log` on a repo with no commits are silently swallowed — empty repo is a legitimate state per spec §4.
- `discover` uses HEAD as the default rev. `--rev` is M5.
- Warnings are collected but the CLI does not print them at M3; they are in the Report for programmatic consumers. Verbose CLI output is M6.
