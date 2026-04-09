# Cache by SHA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache `Report` results keyed by analysis fingerprint (commit SHA + options + file contents) so repeated runs return instantly. Repo-local storage in git-dir, clean-worktree-only, atomic writes.

**Architecture:** Four small cache modules (fingerprint, read, write, dirty-check) in `src/internal/cache/`, wired into `analyze()` before and after the analysis pipeline. Public types updated to add `cached: boolean` to Report meta.

**Tech Stack:** TypeScript 6, Node.js crypto (SHA-256), vitest 4.

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By.

---

## File structure

### New files

| Path                                             | Responsibility                                                  |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `src/internal/cache/compute-fingerprint.ts`      | Build SHA-256 fingerprint from resolved options + file contents |
| `src/internal/cache/compute-fingerprint.test.ts` | Tests                                                           |
| `src/internal/cache/read-cache.ts`               | Read JSON, rehydrate Dates, return Report or undefined          |
| `src/internal/cache/read-cache.test.ts`          | Tests                                                           |
| `src/internal/cache/write-cache.ts`              | Atomic write (tmp + rename)                                     |
| `src/internal/cache/write-cache.test.ts`         | Tests                                                           |
| `src/internal/cache/is-worktree-clean.ts`        | `git status --porcelain --untracked-files=no`                   |
| `src/internal/cache/is-worktree-clean.test.ts`   | Tests                                                           |
| `src/internal/cache/index.ts`                    | Barrel                                                          |

### Modified files

| Path                                       | What changes                                   |
| ------------------------------------------ | ---------------------------------------------- |
| `src/types/report.type.ts`                 | Add `cached: boolean` to meta                  |
| `src/types/analyze-options.type.ts`        | Add `cache?: boolean`                          |
| `src/internal/pipeline/assemble-report.ts` | Set `cached: false` in meta                    |
| `src/analyze.ts`                           | Wire cache read/write around pipeline          |
| `cli/parse-flags.ts`                       | Add `--no-cache` flag                          |
| `src/index.ts`                             | No changes needed (Report re-exported by type) |

---

## Task 1: Update Report type + assembleReport

Add `cached: boolean` to Report meta. Set it to `false` in assembleReport (fresh analysis always produces `cached: false`).

**Files:**

- Modify: `src/types/report.type.ts`
- Modify: `src/internal/pipeline/assemble-report.ts`

- [ ] **Step 1: Add `cached` to Report meta**

In `src/types/report.type.ts`, add `cached: boolean` to the meta interface:

```ts
export interface Report {
  meta: {
    version: string;
    generatedAt: Date;
    durationMs: number;
    cached: boolean;
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

- [ ] **Step 2: Set `cached: false` in assembleReport**

In `src/internal/pipeline/assemble-report.ts`, add `cached: false` to the meta object:

```ts
export const assembleReport = (aggregator: Aggregator, ctx: AssembleContext): Report =>
  aggregator.build(
    {
      version: NODE_FAME_VERSION,
      generatedAt: ctx.startedAt,
      durationMs: ctx.durationMs,
      cached: false,
    },
    {
      path: ctx.path,
      headSha: ctx.headSha,
      headRef: ctx.headRef,
      ...(ctx.range !== undefined && { range: ctx.range }),
      totals: { lines: 0, commits: 0, files: 0 },
    },
  );
```

Note: the `build` method on Aggregator takes `meta: Report['meta']` and `repoBase: Report['repo']`, so passing `cached` in meta should work. Read the Aggregator.build signature to confirm — if it uses `Report['meta']` as the type, the new `cached` field will be required and the compiler will catch any missing spots.

- [ ] **Step 3: Fix any compile errors from the new required field**

```bash
npm run lint 2>&1 | head -20
```

The `cached: boolean` field is required (not optional), so any place that constructs a `Report['meta']` must now include it. Fix each one — likely only `assemble-report.ts` (just done) and possibly test files that construct Report objects directly.

Search for other Report meta constructions:

```bash
grep -rn 'generatedAt' src/ cli/ tests/ --include='*.ts' | grep -v node_modules | grep -v '.d.ts'
```

Fix any that need `cached` added.

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/types/report.type.ts src/internal/pipeline/assemble-report.ts
git commit -m "Add cached field to Report meta type"
```

If other files needed fixing in Step 3, include them in the commit.

---

## Task 2: isWorktreeClean

Check if tracked files are modified. Used to decide whether to read/write cache.

**Files:**

- Create: `src/internal/cache/is-worktree-clean.ts`
- Create: `src/internal/cache/is-worktree-clean.test.ts`

- [ ] **Step 1: Write tests**

Create `src/internal/cache/is-worktree-clean.test.ts`:

```ts
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepo } from '../../../tests/helpers/build-repo.js';
import { isWorktreeClean } from './is-worktree-clean.js';

describe('isWorktreeClean', () => {
  const createdRepos: string[] = [];
  afterEach(() => {
    while (createdRepos.length > 0) {
      const dir = createdRepos.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns true for a clean repo', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    expect(isWorktreeClean(dir)).toBe(true);
  });

  it('returns false when a tracked file is modified', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    writeFileSync(join(dir, 'a.txt'), 'modified\n', 'utf8');
    expect(isWorktreeClean(dir)).toBe(false);
  });

  it('returns true when only untracked files exist', () => {
    const dir = buildRepo([
      { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
    ]);
    createdRepos.push(dir);
    writeFileSync(join(dir, 'untracked.txt'), 'junk\n', 'utf8');
    expect(isWorktreeClean(dir)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/internal/cache/is-worktree-clean.test.ts
```

- [ ] **Step 3: Implement**

Create `src/internal/cache/is-worktree-clean.ts`:

```ts
import { spawnSync } from 'node:child_process';

export const isWorktreeClean = (cwd: string): boolean => {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
  });
  if (result.status !== 0) {
    return false;
  }
  return result.stdout.trim().length === 0;
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/internal/cache/is-worktree-clean.test.ts
```

Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/internal/cache/is-worktree-clean.ts src/internal/cache/is-worktree-clean.test.ts
git commit -m "Add worktree dirty check for cache gating"
```

---

## Task 3: computeFingerprint

Build a deterministic SHA-256 fingerprint from resolved analysis options + file contents.

**Files:**

- Create: `src/internal/cache/compute-fingerprint.ts`
- Create: `src/internal/cache/compute-fingerprint.test.ts`

- [ ] **Step 1: Write tests**

Create `src/internal/cache/compute-fingerprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeFingerprint } from './compute-fingerprint.js';
import type { FingerprintInput } from './compute-fingerprint.js';

const baseInput: FingerprintInput = {
  commitRef: 'abc123',
  since: '',
  until: '',
  followRenames: true,
  ignoreWhitespace: true,
  applyMailmap: true,
  includeGenerated: false,
  includeBinary: false,
  includeMinified: true,
  includeGlobs: [],
  excludeGlobs: [],
  mailmapContent: '',
  gitattributesContent: '',
};

describe('computeFingerprint', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const fp = computeFingerprint(baseInput);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint(baseInput);
    expect(a).toBe(b);
  });

  it('different commitRef produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, commitRef: 'def456' });
    expect(a).not.toBe(b);
  });

  it('different followRenames produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, followRenames: false });
    expect(a).not.toBe(b);
  });

  it('glob order does not affect fingerprint', () => {
    const a = computeFingerprint({ ...baseInput, includeGlobs: ['*.ts', '*.tsx'] });
    const b = computeFingerprint({ ...baseInput, includeGlobs: ['*.tsx', '*.ts'] });
    expect(a).toBe(b);
  });

  it('different mailmap content produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, mailmapContent: 'Proper Name <a@x> <old@x>' });
    expect(a).not.toBe(b);
  });

  it('different since date produces different fingerprint', () => {
    const a = computeFingerprint(baseInput);
    const b = computeFingerprint({ ...baseInput, since: '2024-01-01T00:00:00.000Z' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/internal/cache/compute-fingerprint.test.ts
```

- [ ] **Step 3: Implement**

Create `src/internal/cache/compute-fingerprint.ts`:

```ts
import { createHash } from 'node:crypto';

const CACHE_FORMAT_VERSION = '1';

export interface FingerprintInput {
  commitRef: string;
  since: string;
  until: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
  applyMailmap: boolean;
  includeGenerated: boolean;
  includeBinary: boolean;
  includeMinified: boolean;
  includeGlobs: readonly string[];
  excludeGlobs: readonly string[];
  mailmapContent: string;
  gitattributesContent: string;
}

export const computeFingerprint = (input: FingerprintInput): string => {
  const parts = [
    CACHE_FORMAT_VERSION,
    input.commitRef,
    input.since,
    input.until,
    String(input.followRenames),
    String(input.ignoreWhitespace),
    String(input.applyMailmap),
    String(input.includeGenerated),
    String(input.includeBinary),
    String(input.includeMinified),
    [...input.includeGlobs].sort().join('\0'),
    [...input.excludeGlobs].sort().join('\0'),
    input.mailmapContent,
    input.gitattributesContent,
  ];

  return createHash('sha256').update(parts.join('\n')).digest('hex');
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/internal/cache/compute-fingerprint.test.ts
```

Expected: 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/internal/cache/compute-fingerprint.ts src/internal/cache/compute-fingerprint.test.ts
git commit -m "Add analysis fingerprint computation for cache keys"
```

---

## Task 4: readCache + writeCache

Read cached Report from JSON (with Date rehydration), write atomically.

**Files:**

- Create: `src/internal/cache/read-cache.ts`
- Create: `src/internal/cache/read-cache.test.ts`
- Create: `src/internal/cache/write-cache.ts`
- Create: `src/internal/cache/write-cache.test.ts`

- [ ] **Step 1: Write readCache tests**

Create `src/internal/cache/read-cache.test.ts`:

```ts
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { readCache } from './read-cache.js';

describe('readCache', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('returns undefined when file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    expect(readCache(join(dir, 'nonexistent.json'))).toBeUndefined();
  });

  it('reads and rehydrates Date fields', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'test.json');
    const report = {
      meta: {
        version: '0.1.0',
        generatedAt: '2024-01-01T00:00:00.000Z',
        durationMs: 100,
        cached: false,
      },
      repo: {
        path: '/repo',
        headSha: 'abc',
        headRef: 'HEAD',
        totals: { lines: 1, commits: 1, files: 1 },
      },
      authors: [
        {
          name: 'Alice',
          email: 'a@x',
          linesAlive: 1,
          linesAdded: 1,
          linesDeleted: 0,
          commits: 1,
          files: 1,
          firstCommit: '2024-01-01T00:00:00.000Z',
          lastCommit: '2024-01-01T00:00:00.000Z',
        },
      ],
      warnings: [],
    };
    writeFileSync(file, JSON.stringify(report), 'utf8');

    const result = readCache(file);
    expect(result).toBeDefined();
    expect(result!.meta.generatedAt).toBeInstanceOf(Date);
    expect(result!.authors[0]!.firstCommit).toBeInstanceOf(Date);
    expect(result!.authors[0]!.lastCommit).toBeInstanceOf(Date);
    expect(result!.meta.cached).toBe(false);
  });

  it('returns undefined for corrupt JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{corrupt', 'utf8');
    expect(readCache(file)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write writeCache tests**

Create `src/internal/cache/write-cache.test.ts`:

```ts
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { writeCache } from './write-cache.js';
import type { Report } from '../../types/report.type.js';

const makeReport = (): Report => ({
  meta: {
    version: '0.1.0',
    generatedAt: new Date('2024-01-01T00:00:00.000Z'),
    durationMs: 100,
    cached: false,
  },
  repo: {
    path: '/repo',
    headSha: 'abc',
    headRef: 'HEAD',
    totals: { lines: 1, commits: 1, files: 1 },
  },
  authors: [
    {
      name: 'Alice',
      email: 'a@x',
      linesAlive: 1,
      linesAdded: 1,
      linesDeleted: 0,
      commits: 1,
      files: 1,
      firstCommit: new Date('2024-01-01T00:00:00.000Z'),
      lastCommit: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
  warnings: [],
});

describe('writeCache', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('writes valid JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'report.json');
    writeCache(file, makeReport());
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.meta.version).toBe('0.1.0');
    expect(parsed.authors).toHaveLength(1);
  });

  it('creates parent directories if needed', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'sub', 'dir', 'report.json');
    writeCache(file, makeReport());
    expect(existsSync(file)).toBe(true);
  });

  it('leaves no tmp files behind', () => {
    const dir = mkdtempSync(join(tmpdir(), `cache-test-${randomUUID()}-`));
    dirs.push(dir);
    const file = join(dir, 'report.json');
    writeCache(file, makeReport());
    const files = readdirSync(dir);
    expect(files).toEqual(['report.json']);
  });
});
```

- [ ] **Step 3: Implement readCache**

Create `src/internal/cache/read-cache.ts`:

```ts
import { readFileSync } from 'node:fs';
import type { Report } from '../../types/report.type.js';

export const readCache = (filePath: string): Report | undefined => {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const meta = parsed.meta as Record<string, unknown>;
    meta.generatedAt = new Date(meta.generatedAt as string);

    const authors = parsed.authors as Array<Record<string, unknown>>;
    for (const author of authors) {
      author.firstCommit = new Date(author.firstCommit as string);
      author.lastCommit = new Date(author.lastCommit as string);
    }

    return parsed as unknown as Report;
  } catch {
    return undefined;
  }
};
```

- [ ] **Step 4: Implement writeCache**

Create `src/internal/cache/write-cache.ts`:

```ts
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { Report } from '../../types/report.type.js';

export const writeCache = (filePath: string, report: Report): void => {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp.${randomUUID()}`;
  writeFileSync(tmpPath, JSON.stringify(report), 'utf8');
  renameSync(tmpPath, filePath);
};
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/internal/cache/read-cache.test.ts src/internal/cache/write-cache.test.ts
```

Expected: 6 pass.

- [ ] **Step 6: Commit**

```bash
git add src/internal/cache/read-cache.ts src/internal/cache/read-cache.test.ts src/internal/cache/write-cache.ts src/internal/cache/write-cache.test.ts
git commit -m "Add cache read and atomic write modules"
```

---

## Task 5: Barrel + wire into analyze()

Create the cache barrel, wire everything into `analyze()`, add `cache` to AnalyzeOptions, add `--no-cache` to CLI.

**Files:**

- Create: `src/internal/cache/index.ts`
- Modify: `src/types/analyze-options.type.ts`
- Modify: `src/analyze.ts`
- Modify: `cli/parse-flags.ts`

- [ ] **Step 1: Create barrel**

Create `src/internal/cache/index.ts`:

```ts
export { computeFingerprint, type FingerprintInput } from './compute-fingerprint.js';
export { isWorktreeClean } from './is-worktree-clean.js';
export { readCache } from './read-cache.js';
export { writeCache } from './write-cache.js';
```

- [ ] **Step 2: Add `cache` to AnalyzeOptions**

In `src/types/analyze-options.type.ts`, add before `concurrency`:

```ts
  cache?: boolean;
```

- [ ] **Step 3: Add `--no-cache` to CLI**

In `cli/parse-flags.ts`, add the option after `--concurrency`:

```ts
    .option('--no-cache', 'Disable result caching')
```

And in the analyzeOptions construction, add:

```ts
analyzeOptions.cache = opts.cache as boolean;
```

Note: Commander's `--no-<name>` convention makes `opts.cache` default to `true` and become `false` when `--no-cache` is passed.

- [ ] **Step 4: Wire cache into analyze.ts**

Read `src/analyze.ts`. Add imports at the top:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeFingerprint,
  isWorktreeClean,
  readCache,
  writeCache,
} from './internal/cache/index.js';
import { spawnSync } from 'node:child_process';
```

In `analyze()`, after `const startMs = Date.now();` and after `resolveDefaults`, add the cache check:

```ts
const useCache = options.cache !== false;
let cacheFilePath: string | undefined;

if (useCache) {
  const gitDirResult = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: options.path,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
  });

  if (gitDirResult.status === 0 && isWorktreeClean(options.path)) {
    const gitDir = join(options.path, gitDirResult.stdout.trim());
    const cacheDir = join(gitDir, 'node-fame-cache');

    // Read .mailmap and .gitattributes content for fingerprint
    const mailmapPath = join(options.path, '.mailmap');
    const gitattrsPath = join(options.path, '.gitattributes');
    const mailmapContent = existsSync(mailmapPath) ? readFileSync(mailmapPath, 'utf8') : '';
    const gitattrsContent = existsSync(gitattrsPath) ? readFileSync(gitattrsPath, 'utf8') : '';

    // Build commitRef for fingerprint
    let commitRef = 'HEAD';
    if (options.rev !== undefined) {
      commitRef = options.rev;
    } else if (options.range !== undefined) {
      commitRef = `${options.range.from}..${options.range.to}`;
    }

    const fingerprint = computeFingerprint({
      commitRef,
      since: options.since !== undefined ? options.since.toISOString() : '',
      until: options.until !== undefined ? options.until.toISOString() : '',
      followRenames,
      ignoreWhitespace,
      applyMailmap,
      includeGenerated,
      includeBinary: options.include?.binary ?? false,
      includeMinified,
      includeGlobs,
      excludeGlobs,
      mailmapContent,
      gitattributesContent: gitattrsContent,
    });

    cacheFilePath = join(cacheDir, `${fingerprint}.json`);

    const cached = readCache(cacheFilePath);
    if (cached !== undefined) {
      const cacheDurationMs = Date.now() - startMs;
      cached.meta.durationMs = cacheDurationMs;
      cached.meta.cached = true;
      return cached;
    }
  }
}
```

After the `assembleReport` call at the end (before `return`), add the cache write:

```ts
const report = assembleReport(aggregator, {
  path: options.path,
  headSha: discovered.headSha,
  headRef: discovered.headRef,
  startedAt,
  durationMs,
  ...(discovered.range !== undefined && { range: discovered.range }),
});

if (cacheFilePath !== undefined) {
  try {
    writeCache(cacheFilePath, report);
  } catch {
    // Cache write failure is non-fatal — continue without caching
  }
}

return report;
```

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/internal/cache/index.ts src/types/analyze-options.type.ts src/analyze.ts cli/parse-flags.ts
git commit -m "Wire cache into analyze with --no-cache flag"
```

---

## Task 6: Integration test

Test that `analyze()` returns cached results on second call, and that `--no-cache` bypasses.

**Files:**

- Modify: `src/analyze.test.ts`

- [ ] **Step 1: Add cache integration tests**

Read `src/analyze.test.ts` first. Then append these tests inside the existing describe block:

```ts
it('returns cached result on second call with same options', async () => {
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
  ]);
  createdRepos.push(dir);

  const first = await analyze({ path: dir });
  expect(first.meta.cached).toBe(false);

  const second = await analyze({ path: dir });
  expect(second.meta.cached).toBe(true);
  expect(second.authors).toEqual(first.authors);
  expect(second.repo.headSha).toBe(first.repo.headSha);
});

it('skips cache when cache: false', async () => {
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
  ]);
  createdRepos.push(dir);

  await analyze({ path: dir });
  const second = await analyze({ path: dir, cache: false });
  expect(second.meta.cached).toBe(false);
});

it('skips cache on dirty worktree', async () => {
  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = buildRepo([
    { author: 'Alice <a@x>', date: '2024-01-01T00:00:00Z', files: { 'a.txt': 'hello\n' } },
  ]);
  createdRepos.push(dir);

  await analyze({ path: dir });
  writeFileSync(join(dir, 'a.txt'), 'modified\n', 'utf8');
  const second = await analyze({ path: dir });
  expect(second.meta.cached).toBe(false);
});
```

- [ ] **Step 2: Run all tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/analyze.test.ts
git commit -m "Add cache integration tests"
```

---

## Task 7: Build + verify

Build and test cache behavior end-to-end.

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: First run (cache miss)**

```bash
time node dist/cli/bin.js /Users/mike/work/store --include-generated --include-globs '**/*.ts' '**/*.tsx' '**/*.css' --exclude-globs '**/*lock*'
```

Should take ~11s. Check that cache file was created:

```bash
ls $(git -C /Users/mike/work/store rev-parse --git-dir)/node-fame-cache/
```

- [ ] **Step 3: Second run (cache hit)**

```bash
time node dist/cli/bin.js /Users/mike/work/store --include-generated --include-globs '**/*.ts' '**/*.tsx' '**/*.css' --exclude-globs '**/*lock*'
```

Should be near-instant (< 0.5s). Output should be identical.

- [ ] **Step 4: Verify --no-cache**

```bash
time node dist/cli/bin.js /Users/mike/work/store --include-generated --include-globs '**/*.ts' '**/*.tsx' '**/*.css' --exclude-globs '**/*lock*' --no-cache
```

Should take full ~11s again.

- [ ] **Step 5: No commit — verification only**
