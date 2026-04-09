# Blame Performance Optimizations Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce blame phase overhead by eliminating unnecessary object allocation (streaming count instead of materializing BlameLine[]), precompiling filter matchers, and switching from static round-robin to dynamic file queue for workers.

**Architecture:** Three independent optimizations: (1) replace `parseBlamePorcelain` in the blame worker with a lightweight counting parser that feeds the aggregator directly without creating BlameLine objects; (2) precompile picomatch matchers once in discover() instead of per-file; (3) replace round-robin chunk distribution with a shared queue so workers pull the next file when idle.

**Tech Stack:** TypeScript 6, vitest 4, picomatch.

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By.

---

## File structure

### New files

| Path                                              | Responsibility                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/internal/pipeline/count-blame-lines.ts`      | Lightweight parser: reads porcelain output, calls `aggregator.recordBlameAuthor` per content line without creating intermediate array |
| `src/internal/pipeline/count-blame-lines.test.ts` | Tests for the counting parser                                                                                                         |

### Modified files

| Path                                                           | What changes                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/internal/pipeline/blame-worker.ts`                        | Use `countBlameLines` instead of `parseBlamePorcelain`                   |
| `src/internal/pipeline/run-blame-phase.ts`                     | Dynamic queue instead of round-robin chunks                              |
| `src/internal/filter/matches-user-globs/matches-user-globs.ts` | Accept precompiled matchers                                              |
| `src/internal/filter/is-generated/is-generated.ts`             | Accept precompiled gitattribute matchers                                 |
| `src/internal/pipeline/discover.ts`                            | Precompile matchers once, pass to filters                                |
| `src/internal/identity/aggregator/aggregator.ts`               | Add `recordBlameAuthor(name, mail)` method (avoids BlameLine dependency) |

---

## Task 1: Lightweight counting parser

Replace the full `parseBlamePorcelain` in the blame worker with a minimal parser that only extracts author name + email from porcelain output and calls `aggregator.recordBlameAuthor()` directly. No `BlameLine` array, no `line` content, no `sha`, no `authorTime`.

**Files:**

- Create: `src/internal/pipeline/count-blame-lines.ts`
- Create: `src/internal/pipeline/count-blame-lines.test.ts`
- Modify: `src/internal/identity/aggregator/aggregator.ts`
- Modify: `src/internal/pipeline/blame-worker.ts`

- [ ] **Step 1: Add `recordBlameAuthor` to Aggregator**

The existing `recordBlameLine(line: BlameLine)` uses only `line.authorName` and `line.authorMail`. Add a simpler method that skips the BlameLine indirection.

In `src/internal/identity/aggregator/aggregator.ts`, add after `recordBlameLine`:

```ts
  recordBlameAuthor(name: string, mail: string): void {
    const stats = this.getOrCreate(name, mail);
    stats.linesAlive += 1;
  }
```

Keep `recordBlameLine` for backward compatibility (used by existing parseBlamePorcelain tests).

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npx vitest run src/internal/identity/aggregator/
```

Expected: all aggregator tests pass.

- [ ] **Step 3: Write the counting parser tests**

Create `src/internal/pipeline/count-blame-lines.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildBlameFixture } from '../../../tests/helpers/build-blame-fixture.js';
import { countBlameLines } from './count-blame-lines.js';

describe('countBlameLines', () => {
  it('counts lines per author from porcelain output', () => {
    const fixture = buildBlameFixture([
      {
        sha: 'aaa0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        filename: 'a.txt',
        content: 'line one',
      },
      {
        sha: 'aaa0000000000000000000000000000000000000',
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        filename: 'a.txt',
        content: 'line two',
      },
      {
        sha: 'bbb0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 3,
        groupCount: 1,
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        authorTime: 1704153600,
        summary: 'second',
        filename: 'a.txt',
        content: 'bob line',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);

    const stats = aggregator.getStatsForTesting();
    expect(stats.get('alice@example.com')?.linesAlive).toBe(2);
    expect(stats.get('bob@example.com')?.linesAlive).toBe(1);
  });

  it('returns 0 for empty output', () => {
    const aggregator = new Aggregator();
    countBlameLines('', aggregator);
    expect(aggregator.getStatsForTesting().size).toBe(0);
  });

  it('handles boundary markers', () => {
    const fixture = buildBlameFixture([
      {
        sha: 'ccc0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        boundary: true,
        filename: 'a.txt',
        content: 'boundary line',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);
    expect(aggregator.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(1);
  });

  it('uses cached author info for subsequent lines from same SHA', () => {
    const sha = '1111111111111111111111111111111111111111';
    const fixture = buildBlameFixture([
      {
        sha,
        origLine: 1,
        finalLine: 1,
        groupCount: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'first',
      },
      {
        sha,
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'second',
      },
      {
        sha,
        origLine: 3,
        finalLine: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'third',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);
    expect(aggregator.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(3);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run src/internal/pipeline/count-blame-lines.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 5: Write the counting parser**

Create `src/internal/pipeline/count-blame-lines.ts`:

```ts
import type { Aggregator } from '../identity/aggregator/index.js';

const HEADER_REGEX = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/;

const stripAngleBrackets = (s: string): string =>
  s.startsWith('<') && s.endsWith('>') ? s.slice(1, -1) : s;

export const countBlameLines = (output: string, aggregator: Aggregator): void => {
  if (output.length === 0) {
    return;
  }

  const cache = new Map<string, { name: string; mail: string }>();
  let currentSha = '';
  let currentName = '';
  let currentMail = '';
  let hasCached = false;

  for (const raw of output.split('\n')) {
    if (raw.length === 0) {
      continue;
    }

    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (line.startsWith('\t')) {
      aggregator.recordBlameAuthor(currentName, currentMail);
      if (!hasCached && currentSha !== '') {
        cache.set(currentSha, { name: currentName, mail: currentMail });
      }
      hasCached = false;
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(line);
    if (headerMatch !== null) {
      currentSha = headerMatch[1] ?? '';
      const cached = cache.get(currentSha);
      if (cached !== undefined) {
        currentName = cached.name;
        currentMail = cached.mail;
        hasCached = true;
      }
      continue;
    }

    if (line.startsWith('author ')) {
      currentName = line.slice(7);
      continue;
    }

    if (line.startsWith('author-mail ')) {
      currentMail = stripAngleBrackets(line.slice(12));
      continue;
    }
  }
};
```

This parser:

- Splits the output once (same as before) but creates zero objects per line
- Tracks only `currentName`/`currentMail` as mutable strings
- Caches per SHA (same as the full parser)
- Calls `aggregator.recordBlameAuthor(name, mail)` on each content line (tab prefix)
- Ignores all other metadata (authorTime, sha, summary, filename, boundary) -- not needed for counting

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/internal/pipeline/count-blame-lines.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 7: Wire into blame-worker.ts**

In `src/internal/pipeline/blame-worker.ts`, replace the import:

Change:

```ts
import { parseBlamePorcelain } from '../parse/parse-blame-porcelain/index.js';
```

to:

```ts
import { countBlameLines } from './count-blame-lines.js';
```

Replace the try block:

```ts
        try {
          const blameLines = parseBlamePorcelain(blameOutput);
          for (const line of blameLines) {
            aggregator.recordBlameLine(line);
          }
        }
```

with:

```ts
        try {
          countBlameLines(blameOutput, aggregator);
        }
```

- [ ] **Step 8: Run full test suite**

```bash
npm run lint && npm run test:run
```

Expected: all 303 tests pass, lint clean.

- [ ] **Step 9: Commit**

```bash
git add src/internal/pipeline/count-blame-lines.ts src/internal/pipeline/count-blame-lines.test.ts src/internal/pipeline/blame-worker.ts src/internal/identity/aggregator/aggregator.ts
git commit -m "Replace BlameLine[] materialization with direct counting parser"
```

---

## Task 2: Precompile picomatch matchers in discover

Currently `matchesUserGlobs` calls `picomatch()` on every file (3307x for the store repo). Same for `isGenerated` which calls `picomatch()` per gitattribute pattern per file. Precompile once, reuse for all files.

**Files:**

- Modify: `src/internal/filter/matches-user-globs/matches-user-globs.ts`
- Modify: `src/internal/filter/is-generated/is-generated.ts`
- Modify: `src/internal/pipeline/discover.ts`

- [ ] **Step 1: Refactor matchesUserGlobs to accept precompiled matchers**

Replace `src/internal/filter/matches-user-globs/matches-user-globs.ts`:

```ts
import picomatch from 'picomatch';

export const compileMatchers = (patterns: readonly string[]): ((path: string) => boolean)[] =>
  patterns.map((p) => picomatch(p, { dot: true, matchBase: !p.includes('/') }));

const matchesAny = (path: string, matchers: ((path: string) => boolean)[]): boolean =>
  matchers.some((m) => m(path));

export const matchesUserGlobs = (
  relPath: string,
  includeMatchers: ((path: string) => boolean)[],
  excludeMatchers: ((path: string) => boolean)[],
): boolean => {
  if (excludeMatchers.length > 0 && matchesAny(relPath, excludeMatchers)) {
    return false;
  }

  if (includeMatchers.length > 0) {
    return matchesAny(relPath, includeMatchers);
  }

  return true;
};
```

- [ ] **Step 2: Refactor isGenerated to accept precompiled gitattribute matchers**

Replace `src/internal/filter/is-generated/is-generated.ts`:

```ts
import picomatch from 'picomatch';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { matchBuiltInPatterns } from './helpers/match-built-in-patterns.js';

export interface CompiledAttrRule {
  matcher: (path: string) => boolean;
  generatedExplicit?: boolean;
  vendoredExplicit?: boolean;
}

export const compileGitattributeMatchers = (attrs: GitattributesMap): CompiledAttrRule[] => {
  const rules: CompiledAttrRule[] = [];
  for (const [pattern, attrValues] of attrs) {
    const matchBase = !pattern.includes('/');
    rules.push({
      matcher: picomatch(pattern, { dot: true, matchBase }),
      generatedExplicit: attrValues['linguist-generated'],
      vendoredExplicit: attrValues['linguist-vendored'],
    });
  }
  return rules;
};

export const isGenerated = (relPath: string, compiledRules: CompiledAttrRule[]): boolean => {
  for (const rule of compiledRules) {
    if (!rule.matcher(relPath)) {
      continue;
    }
    if (rule.generatedExplicit === false || rule.vendoredExplicit === false) {
      return false;
    }
    if (rule.generatedExplicit === true || rule.vendoredExplicit === true) {
      return true;
    }
  }
  return matchBuiltInPatterns(relPath);
};
```

- [ ] **Step 3: Update discover.ts to precompile**

In `src/internal/pipeline/discover.ts`, update imports:

```ts
import { compileGitattributeMatchers, isGenerated } from '../filter/is-generated/index.js';
import { compileMatchers, matchesUserGlobs } from '../filter/matches-user-globs/index.js';
```

Before the file loop (after `const attrs = ...`), add precompilation:

```ts
const compiledAttrs = attrs !== null ? compileGitattributeMatchers(attrs) : null;
const includeMatchers = compileMatchers(options.includeGlobs);
const excludeMatchers = compileMatchers(options.excludeGlobs);
```

Change the filter calls inside the loop:

From:

```ts
      if (!matchesUserGlobs(relPath, options.includeGlobs, options.excludeGlobs)) {
```

To:

```ts
      if (!matchesUserGlobs(relPath, includeMatchers, excludeMatchers)) {
```

From:

```ts
      if (attrs !== null && isGenerated(relPath, attrs)) {
```

To:

```ts
      if (compiledAttrs !== null && isGenerated(relPath, compiledAttrs)) {
```

- [ ] **Step 4: Update barrel exports**

In `src/internal/filter/is-generated/index.ts`, add `compileGitattributeMatchers` and `type CompiledAttrRule` to exports.

In `src/internal/filter/matches-user-globs/index.ts`, add `compileMatchers` to exports.

- [ ] **Step 5: Update tests that call matchesUserGlobs directly**

Read `src/internal/filter/matches-user-globs/matches-user-globs.test.ts`. Update any direct calls to pass precompiled matchers instead of raw string arrays. Each test should call `compileMatchers(patterns)` first, then pass the result.

Similarly for `src/internal/filter/is-generated/is-generated.test.ts` -- update to use `compileGitattributeMatchers`.

- [ ] **Step 6: Run full test suite**

```bash
npm run lint && npm run test:run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/internal/filter/ src/internal/pipeline/discover.ts
git commit -m "Precompile picomatch matchers once per analysis run"
```

---

## Task 3: Dynamic file queue for blame workers

Replace round-robin chunk assignment with a shared queue. Workers pull the next file path from a queue when idle. This prevents fast workers from idling while one worker grinds through a large file.

**Files:**

- Modify: `src/internal/pipeline/blame-worker.ts`
- Modify: `src/internal/pipeline/run-blame-phase.ts`

- [ ] **Step 1: Redesign blame-worker to process files one at a time**

The worker exposes a `blame(file)` method that sends a file to the shell process and resolves when the blame output is received. The parent dispatches files from a shared counter.

Replace `src/internal/pipeline/blame-worker.ts`:

```ts
import { spawn } from 'node:child_process';
import { countBlameLines } from './count-blame-lines.js';
import type { Aggregator } from '../identity/aggregator/index.js';

const SEPARATOR = '__BLAME_END__';

interface BlameWorkerOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const buildBlameCommand = (
  rev: string,
  followRenames: boolean,
  ignoreWhitespace: boolean,
): string => {
  const parts = ['git blame --porcelain', rev];
  if (followRenames) {
    parts.push('-M -C');
  }
  if (ignoreWhitespace) {
    parts.push('-w');
  }
  return parts.join(' ');
};

export interface BlameWorker {
  blame(file: string): Promise<void>;
  close(): void;
}

export const createBlameWorker = (
  cwd: string,
  aggregator: Aggregator,
  options: BlameWorkerOptions,
): BlameWorker => {
  const blameCmd = buildBlameCommand(options.rev, options.followRenames, options.ignoreWhitespace);

  const child = spawn(
    'sh',
    [
      '-c',
      `while IFS= read -r file; do ${blameCmd} -- "$file" 2>/dev/null; echo "${SEPARATOR}"; done`,
    ],
    { cwd, stdio: ['pipe', 'pipe', 'ignore'] },
  );

  let buffer = '';
  let currentFile = '';
  let resolver: (() => void) | null = null;

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf(SEPARATOR + '\n')) !== -1) {
      const blameOutput = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + SEPARATOR.length + 1);

      if (blameOutput.length === 0) {
        aggregator.recordWarning({
          code: 'BLAME_FAILED',
          file: currentFile,
          error: 'empty output',
          message: `git blame produced no output for ${currentFile}`,
        });
      } else {
        try {
          countBlameLines(blameOutput, aggregator);
        } catch {
          aggregator.recordWarning({
            code: 'BLAME_FAILED',
            file: currentFile,
            error: 'parse error',
            message: `Failed to parse blame output for ${currentFile}`,
          });
        }
      }

      if (resolver !== null) {
        const r = resolver;
        resolver = null;
        r();
      }
    }
  });

  child.on('error', (err) => {
    if (resolver !== null) {
      resolver();
      resolver = null;
    }
    aggregator.recordWarning({
      code: 'BLAME_FAILED',
      file: currentFile,
      error: err.message,
      message: `Blame worker error: ${err.message}`,
    });
  });

  child.on('close', () => {
    if (resolver !== null) {
      resolver();
      resolver = null;
    }
  });

  return {
    blame(file: string): Promise<void> {
      return new Promise((resolve) => {
        currentFile = file;
        resolver = resolve;
        child.stdin.write(file + '\n');
      });
    },
    close(): void {
      child.stdin.end();
    },
  };
};
```

- [ ] **Step 2: Rewrite run-blame-phase.ts with dynamic queue**

Replace `src/internal/pipeline/run-blame-phase.ts`:

```ts
import { cpus } from 'node:os';
import { createBlameWorker } from './blame-worker.js';
import type { BlameWorker } from './blame-worker.js';
import type { Aggregator } from '../identity/aggregator/index.js';
import type { ProgressEvent } from '../../types/progress-event.type.js';

export interface BlameOptions {
  rev: string;
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const resolveWorkerCount = (concurrency: number | undefined, fileCount: number): number => {
  const cpuBased = Math.min(cpus().length * 3, 32);
  const requested = concurrency ?? cpuBased;
  return Math.min(requested, fileCount);
};

export const runBlamePhase = async (
  cwd: string,
  files: readonly string[],
  aggregator: Aggregator,
  options: BlameOptions,
  onProgress?: (event: ProgressEvent) => void,
  concurrency?: number,
): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const workerCount = resolveWorkerCount(concurrency, files.length);
  const workers = Array.from({ length: workerCount }, () =>
    createBlameWorker(cwd, aggregator, options),
  );

  let nextIdx = 0;
  let completed = 0;

  const runWorker = async (worker: BlameWorker): Promise<void> => {
    while (nextIdx < files.length) {
      const idx = nextIdx;
      nextIdx += 1;
      const file = files[idx]!;
      await worker.blame(file);
      completed += 1;
      onProgress?.({ type: 'blame', file, done: completed, total: files.length });
    }
    worker.close();
  };

  await Promise.all(workers.map(runWorker));
};
```

Each worker grabs the next file from the shared `nextIdx` counter. Since Node.js is single-threaded, the increment is safe -- no race conditions.

- [ ] **Step 3: Run full test suite**

```bash
npm run lint && npm run test:run
```

Expected: all tests pass (including all run-blame-phase tests -- the API is unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/internal/pipeline/blame-worker.ts src/internal/pipeline/run-blame-phase.ts
git commit -m "Switch blame workers from round-robin chunks to dynamic queue"
```

---

## Task 4: Build + benchmark

Build and run on the store repo to measure the combined impact.

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Benchmark with default concurrency**

```bash
time node dist/cli/bin.js /Users/mike/work/store --include-generated --include-globs '**/*.ts' '**/*.tsx' '**/*.css' --exclude-globs '**/*lock*'
```

Compare with the pre-optimization baseline of ~13.7s (32 workers, round-robin, full BlameLine materialization).

- [ ] **Step 3: Benchmark single-thread**

```bash
time node dist/cli/bin.js /Users/mike/work/store --include-generated --include-globs '**/*.ts' '**/*.tsx' '**/*.css' --exclude-globs '**/*lock*' --concurrency 1
```

Compare with pre-optimization single-thread baseline of ~80s.

- [ ] **Step 4: No commit -- verification only**
