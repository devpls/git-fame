# M4b User Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users full control over node-fame's filtering via CLI flags and library options. After this plan, `npx node-fame --include-globs '*.ts' '*.tsx' '*.css' /path/to/repo` produces numbers that match `git-fame` for the same filter set. Every default from the spec is overridable via a `--flag`.

**Architecture:** Three new filters (`isMinified`, `matchesUserGlobs`, plus the existing `isBinary`/`isGenerated` from M4a) are integrated into the `discover` phase. `AnalyzeOptions` grows `includeGlobs`, `excludeGlobs`, and `include.minified`. The CLI switches from raw `process.argv` to `commander` with typed options mapped to `AnalyzeOptions` via a `parseFlags` helper. Commander handles `--help`, `--version`, validation, and `--no-*` boolean inversions out of the box.

**Tech Stack:** TypeScript 6, Node 20+, vitest 4, commander (new runtime dep), picomatch (already installed).

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. See `CLAUDE.md`.

**Context for implementer:** M4a is complete (210 tests, generated filter, blame `-w -M -C`, mailmap). The CLI at `cli/bin.ts` currently reads `process.argv[2]` directly — no flag parsing. `AnalyzeOptions` has `path`, `include.{whitespace, binary, generated}`, and `options.{followRenames, applyMailmap}`. This plan adds `include.minified`, `includeGlobs`, `excludeGlobs`, and wires all options to commander flags. Read `CLAUDE.md` for conventions.

---

## File structure

### New files

| Path                                                                | Responsibility                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/internal/filter/is-minified/index.ts`                          | barrel                                                      |
| `src/internal/filter/is-minified/is-minified.ts`                    | `isMinified(absPath)` — average line length heuristic       |
| `src/internal/filter/is-minified/is-minified.test.ts`               | unit tests                                                  |
| `src/internal/filter/matches-user-globs/index.ts`                   | barrel                                                      |
| `src/internal/filter/matches-user-globs/matches-user-globs.ts`      | `matchesUserGlobs(relPath, include, exclude)` via picomatch |
| `src/internal/filter/matches-user-globs/matches-user-globs.test.ts` | unit tests                                                  |
| `cli/parse-flags.ts`                                                | commander setup → `AnalyzeOptions`                          |
| `cli/parse-flags.test.ts`                                           | unit tests for flag → options mapping                       |

### Modified files

| Path                                     | What changes                                                |
| ---------------------------------------- | ----------------------------------------------------------- |
| `package.json`                           | Add `commander` runtime dep                                 |
| `src/types/analyze-options.type.ts`      | Add `includeGlobs`, `excludeGlobs`, `include.minified`      |
| `src/internal/pipeline/discover.ts`      | Integrate minified + glob filters, expand `DiscoverOptions` |
| `src/internal/pipeline/discover.test.ts` | New filter pair tests                                       |
| `src/analyze.ts`                         | Thread new options                                          |
| `src/analyze.test.ts`                    | End-to-end filter tests                                     |
| `cli/bin.ts`                             | Rewrite with commander, use `parseFlags`                    |

---

## Task 1: Install `commander` runtime dependency

**Files:**

- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install commander
```

- [ ] **Step 2: Verify**

Run: `npm ls --depth=0 --prod`
Expected: `cli-table3`, `p-limit`, `picomatch`, `commander`.

- [ ] **Step 3: Lint + tests**

```bash
npm run lint && npm run test:run
```

Expected: exits 0, 210 tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install commander runtime dependency"
```

---

## Task 2: `isMinified` filter

**Files:**

- Create: `src/internal/filter/is-minified/is-minified.ts`
- Create: `src/internal/filter/is-minified/is-minified.test.ts`
- Create: `src/internal/filter/is-minified/index.ts`

Heuristic: a file is "minified" if it has at least one line AND the average line length exceeds 500 characters. Reads first 64 KB to avoid loading huge files entirely.

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/is-minified/is-minified.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isMinified } from './is-minified.js';

describe('isMinified', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeFile = (name: string, content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-minified-'));
    created.push(dir);
    const path = join(dir, name);
    writeFileSync(path, content, 'utf8');
    return path;
  };

  it('returns false for a normal source file', () => {
    const path = makeFile('a.ts', 'const x = 1;\nconst y = 2;\nconst z = 3;\n');
    expect(isMinified(path)).toBe(false);
  });

  it('returns true for a single-line file with avg length > 500', () => {
    const longLine = 'a'.repeat(1000) + '\n';
    const path = makeFile('bundle.min.js', longLine);
    expect(isMinified(path)).toBe(true);
  });

  it('returns true when average line length exceeds threshold', () => {
    const lines = Array.from({ length: 10 }, () => 'x'.repeat(600)).join('\n') + '\n';
    const path = makeFile('packed.js', lines);
    expect(isMinified(path)).toBe(true);
  });

  it('returns false for an empty file', () => {
    const path = makeFile('empty.js', '');
    expect(isMinified(path)).toBe(false);
  });

  it('returns false when lines are long but below threshold', () => {
    const lines = Array.from({ length: 5 }, () => 'y'.repeat(200)).join('\n') + '\n';
    const path = makeFile('long-but-ok.ts', lines);
    expect(isMinified(path)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-minified/is-minified.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/internal/filter/is-minified/is-minified.ts`:

```ts
import { openSync, readSync, closeSync } from 'node:fs';

const PROBE_BYTES = 65536;
const AVG_LINE_LENGTH_THRESHOLD = 500;

export const isMinified = (absPath: string): boolean => {
  const fd = openSync(absPath, 'r');
  try {
    const buffer = Buffer.alloc(PROBE_BYTES);
    const bytesRead = readSync(fd, buffer, 0, PROBE_BYTES, 0);
    if (bytesRead === 0) {
      return false;
    }

    const text = buffer.toString('utf8', 0, bytesRead);
    const lines = text.split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
      return false;
    }

    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    const avgLength = totalChars / lines.length;
    return avgLength > AVG_LINE_LENGTH_THRESHOLD;
  } finally {
    closeSync(fd);
  }
};
```

- [ ] **Step 4: Create barrel**

Create `src/internal/filter/is-minified/index.ts`:

```ts
export { isMinified } from './is-minified.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-minified/is-minified.test.ts`
Expected: 5 green.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/internal/filter/is-minified
git commit -m "Add isMinified heuristic filter"
```

---

## Task 3: `matchesUserGlobs` filter

**Files:**

- Create: `src/internal/filter/matches-user-globs/matches-user-globs.ts`
- Create: `src/internal/filter/matches-user-globs/matches-user-globs.test.ts`
- Create: `src/internal/filter/matches-user-globs/index.ts`

Logic:

1. If `includeGlobs` is non-empty: file must match at least one include pattern. Otherwise reject.
2. If `excludeGlobs` is non-empty: file must NOT match any exclude pattern. Otherwise reject.
3. Exclude wins over include if both match (safe default).
4. Both empty → all files pass.

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/matches-user-globs/matches-user-globs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesUserGlobs } from './matches-user-globs.js';

describe('matchesUserGlobs', () => {
  it('returns true when no globs are provided', () => {
    expect(matchesUserGlobs('any/file.ts', [], [])).toBe(true);
  });

  it('includes files matching includeGlobs', () => {
    expect(matchesUserGlobs('src/index.ts', ['*.ts'], [])).toBe(true);
  });

  it('excludes files not matching includeGlobs', () => {
    expect(matchesUserGlobs('src/style.css', ['*.ts'], [])).toBe(false);
  });

  it('excludes files matching excludeGlobs', () => {
    expect(matchesUserGlobs('vendor/lib.ts', [], ['vendor/**'])).toBe(false);
  });

  it('exclude wins over include when both match', () => {
    expect(matchesUserGlobs('vendor/lib.ts', ['*.ts'], ['vendor/**'])).toBe(false);
  });

  it('handles deep paths with ** include patterns', () => {
    expect(matchesUserGlobs('src/deep/nested/file.tsx', ['**/*.tsx'], [])).toBe(true);
  });

  it('supports multiple include patterns (OR logic)', () => {
    expect(matchesUserGlobs('style.css', ['*.ts', '*.css'], [])).toBe(true);
    expect(matchesUserGlobs('readme.md', ['*.ts', '*.css'], [])).toBe(false);
  });

  it('supports multiple exclude patterns (OR logic)', () => {
    expect(matchesUserGlobs('test.snap', [], ['*.snap', '*.log'])).toBe(false);
    expect(matchesUserGlobs('test.ts', [], ['*.snap', '*.log'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/matches-user-globs/matches-user-globs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/internal/filter/matches-user-globs/matches-user-globs.ts`:

```ts
import picomatch from 'picomatch';

export const matchesUserGlobs = (
  relPath: string,
  includeGlobs: readonly string[],
  excludeGlobs: readonly string[],
): boolean => {
  if (excludeGlobs.length > 0) {
    const isExcluded = picomatch(excludeGlobs as string[], { dot: true, matchBase: true });
    if (isExcluded(relPath)) {
      return false;
    }
  }

  if (includeGlobs.length > 0) {
    const isIncluded = picomatch(includeGlobs as string[], { dot: true, matchBase: true });
    return isIncluded(relPath);
  }

  return true;
};
```

Note: `matchBase: true` makes patterns without `/` match anywhere in the path (e.g. `*.ts` matches `src/foo/bar.ts`), which is the intuitive behaviour for CLI users.

- [ ] **Step 4: Create barrel**

Create `src/internal/filter/matches-user-globs/index.ts`:

```ts
export { matchesUserGlobs } from './matches-user-globs.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/matches-user-globs/matches-user-globs.test.ts`
Expected: 8 green.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/internal/filter/matches-user-globs
git commit -m "Add matchesUserGlobs picomatch filter"
```

---

## Task 4: Expand `AnalyzeOptions` + integrate filters + thread through `analyze()`

**Files:**

- Modify: `src/types/analyze-options.type.ts`
- Modify: `src/internal/pipeline/discover.ts`
- Modify: `src/internal/pipeline/discover.test.ts`
- Modify: `src/analyze.ts`
- Modify: `src/analyze.test.ts`

This task is transactional — all changes land in one commit so the tree stays compilable.

### Part A: Expand `AnalyzeOptions`

Replace `src/types/analyze-options.type.ts`:

```ts
export interface AnalyzeOptions {
  path: string;

  include?: {
    whitespace?: boolean;
    binary?: boolean;
    generated?: boolean;
    /** Include minified files. Default: true (minified ARE counted by default). */
    minified?: boolean;
  };

  options?: {
    followRenames?: boolean;
    applyMailmap?: boolean;
  };

  /** Only analyze files matching at least one of these globs. Empty = all files. */
  includeGlobs?: string[];
  /** Exclude files matching any of these globs. Exclude wins over include. */
  excludeGlobs?: string[];
}
```

### Part B: Update `DiscoverOptions` and `discover`

Expand `DiscoverOptions` in `src/internal/pipeline/discover.ts`:

```ts
export interface DiscoverOptions {
  includeGenerated: boolean;
  includeMinified: boolean;
  includeGlobs: readonly string[];
  excludeGlobs: readonly string[];
}
```

Update discover to apply filters in this order:

1. **User globs first** (fastest — pure string match, no IO). If `includeGlobs` is non-empty, reject files that don't match.
2. **isGenerated** (pattern match, no IO).
3. **isBinary** (reads 8KB from disk).
4. **isMinified** (reads 64KB from disk). Only when `includeMinified === false`.

Update existing tests to pass the expanded `DiscoverOptions`.

Add two new tests:

- "filters out minified files when includeMinified is false"
- "respects user includeGlobs to narrow the file set"

### Part C: Thread through `analyze()`

Update `resolveDefaults` in `src/analyze.ts`:

```ts
const resolveDefaults = (options: AnalyzeOptions) => ({
  includeGenerated: options.include?.generated ?? false,
  includeMinified: options.include?.minified ?? true,
  ignoreWhitespace: !(options.include?.whitespace ?? false),
  followRenames: options.options?.followRenames ?? true,
  applyMailmap: options.options?.applyMailmap ?? true,
  includeGlobs: options.includeGlobs ?? [],
  excludeGlobs: options.excludeGlobs ?? [],
});
```

Pass the new fields to `discover()`.

Add 2 new end-to-end tests in `src/analyze.test.ts`:

- "respects includeGlobs to filter files" — build repo with .ts + .md, pass `includeGlobs: ['*.ts']`, verify only .ts counted
- "excludes minified files when include.minified is false" — build repo with a minified file, verify excluded

### Execution

1. Read current files
2. Apply ALL changes together
3. `npm run lint` → must exit 0
4. `npm run test:run` → must pass
5. Commit:

```bash
git add src/types/analyze-options.type.ts src/internal/pipeline/discover.ts src/internal/pipeline/discover.test.ts src/internal/filter/is-minified src/internal/filter/matches-user-globs src/analyze.ts src/analyze.test.ts
git commit -m "Integrate minified and user glob filters across the pipeline"
```

---

## Task 5: Commander CLI with flags

**Files:**

- Create: `cli/parse-flags.ts`
- Create: `cli/parse-flags.test.ts`
- Modify: `cli/bin.ts`

### Part A: `parseFlags` helper

Create `cli/parse-flags.ts`:

```ts
import { Command } from 'commander';
import type { AnalyzeOptions } from '../src/types/analyze-options.type.js';

export interface ParsedFlags {
  options: AnalyzeOptions;
  format: string;
}

export const parseFlags = (argv: string[]): ParsedFlags => {
  const program = new Command()
    .name('node-fame')
    .version('0.1.0')
    .description('Fast, accurate git contribution stats — lines, commits, files per author.')
    .argument('[path]', 'Repository path', process.cwd())
    .option('--include-whitespace', 'Count whitespace-only changes as meaningful')
    .option('--include-binary', 'Include binary files in analysis')
    .option('--include-generated', 'Include generated/vendored files (lock files, dist/, etc.)')
    .option('--exclude-minified', 'Exclude minified files (avg line length > 500 chars)')
    .option('--no-follow-renames', 'Do not follow renames/copies in git blame')
    .option('--no-mailmap', 'Do not apply .mailmap for identity canonicalisation')
    .option('--include-globs <patterns...>', 'Only analyze files matching these glob patterns')
    .option('--exclude-globs <patterns...>', 'Exclude files matching these glob patterns')
    .option('--format <format>', 'Output format (table)', 'table')
    .parse(argv);

  const opts = program.opts<{
    includeWhitespace?: boolean;
    includeBinary?: boolean;
    includeGenerated?: boolean;
    excludeMinified?: boolean;
    followRenames: boolean;
    mailmap: boolean;
    includeGlobs?: string[];
    excludeGlobs?: string[];
    format: string;
  }>();

  const path = program.args[0] ?? process.cwd();

  return {
    options: {
      path,
      include: {
        whitespace: opts.includeWhitespace ?? false,
        binary: opts.includeBinary ?? false,
        generated: opts.includeGenerated ?? false,
        minified: opts.excludeMinified === true ? false : undefined,
      },
      options: {
        followRenames: opts.followRenames,
        applyMailmap: opts.mailmap,
      },
      includeGlobs: opts.includeGlobs,
      excludeGlobs: opts.excludeGlobs,
    },
    format: opts.format,
  };
};
```

Note: commander handles `--no-follow-renames` → `followRenames: false` and `--no-mailmap` → `mailmap: false` automatically via its --no- convention.

Note: `include.minified` default is `undefined` (not `true`) when `--exclude-minified` is not passed. The `analyze()` `resolveDefaults` maps `undefined` → `true`.

### Part B: Tests for `parseFlags`

Create `cli/parse-flags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseFlags } from './parse-flags.js';

const base = ['node', 'node-fame'];

describe('parseFlags', () => {
  it('defaults to cwd when no path is given', () => {
    const { options } = parseFlags([...base]);
    expect(options.path).toBe(process.cwd());
  });

  it('takes path from the first positional argument', () => {
    const { options } = parseFlags([...base, '/my/repo']);
    expect(options.path).toBe('/my/repo');
  });

  it('sets include.whitespace when --include-whitespace is passed', () => {
    const { options } = parseFlags([...base, '--include-whitespace']);
    expect(options.include?.whitespace).toBe(true);
  });

  it('sets include.generated when --include-generated is passed', () => {
    const { options } = parseFlags([...base, '--include-generated']);
    expect(options.include?.generated).toBe(true);
  });

  it('disables followRenames with --no-follow-renames', () => {
    const { options } = parseFlags([...base, '--no-follow-renames']);
    expect(options.options?.followRenames).toBe(false);
  });

  it('disables mailmap with --no-mailmap', () => {
    const { options } = parseFlags([...base, '--no-mailmap']);
    expect(options.options?.applyMailmap).toBe(false);
  });

  it('passes include-globs as an array', () => {
    const { options } = parseFlags([...base, '--include-globs', '*.ts', '*.tsx']);
    expect(options.includeGlobs).toEqual(['*.ts', '*.tsx']);
  });

  it('passes exclude-globs as an array', () => {
    const { options } = parseFlags([...base, '--exclude-globs', 'vendor/**']);
    expect(options.excludeGlobs).toEqual(['vendor/**']);
  });

  it('sets minified to false with --exclude-minified', () => {
    const { options } = parseFlags([...base, '--exclude-minified']);
    expect(options.include?.minified).toBe(false);
  });

  it('defaults format to table', () => {
    const { format } = parseFlags([...base]);
    expect(format).toBe('table');
  });
});
```

### Part C: Rewrite `cli/bin.ts`

Replace `cli/bin.ts`:

```ts
#!/usr/bin/env node
import { analyze } from '../src/analyze.js';
import { render } from '../src/render/index.js';
import { parseFlags } from './parse-flags.js';
import type { RenderFormat } from '../src/render/index.js';

const main = async (): Promise<void> => {
  const { options, format } = parseFlags(process.argv);
  const report = await analyze(options);
  const output = render(report, format as RenderFormat);
  process.stdout.write(output + '\n');
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
```

### Execution

1. Write `parse-flags.ts` and `parse-flags.test.ts`
2. Run tests for parse-flags → pass
3. Rewrite `bin.ts`
4. Run full lint + test suite
5. Build + smoke test:

```bash
rm -rf dist && npm run build
node dist/cli/bin.js --help
node dist/cli/bin.js --include-globs '*.ts' '*.tsx' '*.css' /Users/mike/work/store
```

Expected: `--help` prints all flags. The store command should produce ~135k lines (matching git-fame's filter).

6. Commit:

```bash
git add cli/parse-flags.ts cli/parse-flags.test.ts cli/bin.ts
git commit -m "Add commander CLI with all filter flags"
```

---

## Task 6: Dogfood verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
rm -rf dist && npm run build
```

- [ ] **Step 2: Run with git-fame equivalent filters**

```bash
node dist/cli/bin.js --include-globs '*.ts' '*.tsx' '*.css' /Users/mike/work/store
```

Expected: total `linesAlive` around **130 000–140 000** — matching git-fame's 135 159 for the same filter set.

- [ ] **Step 3: Run with default filters (no flags)**

```bash
node dist/cli/bin.js /Users/mike/work/store
```

Expected: ~174k (same as M4a dogfood — minified filter is off by default).

- [ ] **Step 4: Run with --exclude-minified**

```bash
node dist/cli/bin.js --exclude-minified /Users/mike/work/store
```

Expected: may drop slightly further from 174k if any minified files are present.

- [ ] **Step 5: Test flag overrides**

```bash
# Include generated files
node dist/cli/bin.js --include-generated /Users/mike/work/store

# Disable mailmap
node dist/cli/bin.js --no-mailmap .

# Show help
node dist/cli/bin.js --help
```

Expected: each command runs without error; `--include-generated` shows higher numbers; `--no-mailmap` on node-fame repo shows two Mykhailo entries; `--help` lists all flags.

- [ ] **Step 6: Run on node-fame repo**

```bash
node dist/cli/bin.js .
```

Expected: table output, sensible numbers.

- [ ] **Step 7: Full test suite, lint, coverage**

```bash
npm run lint
npm run test:run
npm run coverage
```

Expected: all green; ≥ 90% coverage; new modules at ≥ 95%.

- [ ] **Step 8: Verify git state**

```bash
git status
git log --oneline feat/initial ^main | head -10
```

Expected: clean tree, ~5 new M4b commits.

- [ ] **Step 9: Paste dogfood output**

Drop the table from Step 2 (with `--include-globs` matching git-fame) into the session so the user can compare with the git-fame baseline of 135 159 lines.
