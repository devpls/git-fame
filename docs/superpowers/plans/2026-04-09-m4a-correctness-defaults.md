# M4a Correctness Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `node-fame` produce honest numbers by default — without any user action. After this plan, dogfood on the `/Users/mike/work/store` repository should drop from ~520k alive lines to ~135k, matching what `git-fame` reports for the same repo with hand-tuned filters.

**Architecture:** Four independent correctness improvements wired into the existing M3 pipeline. (1) `is-generated` filter excludes lock files, build output, generated migrations, and `linguist-generated`-tagged files via a built-in pattern list plus `.gitattributes` parsing. (2) The blame phase adds `-w` (ignore whitespace-only changes) and `-M -C` (follow renames/copies) by default. (3) `Mailmap` loads the repo's `.mailmap` and the `Aggregator` canonicalises every author identity through it before keying. (4) `AnalyzeOptions` grows the `include` and `options` sub-objects so each default can be flipped via the library API. CLI flag wiring is deferred to **M4b** (a separate plan); M4a is library-only.

**Tech Stack:** TypeScript 6 (strict), Node 20+, vitest 4. New runtime dependency: `picomatch` (for built-in pattern matching).

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. See `CLAUDE.md`.

**Context for implementer:** M0–M3 are complete. The CLI runs end-to-end on real repos. Read **`CLAUDE.md`** for conventions, especially "Context → class, no-context → arrow", "Fast exit over nested if", "One function or class per file" (with folder-pattern), and the `.type.ts` test exemption. Read **`docs/superpowers/specs/2026-04-08-node-fame-design.md`** Section 1 (defaults), Section 2 (`AnalyzeOptions` shape), and Section 3 (filter and identity component descriptions). The dogfood baseline before this plan is documented in the M3 plan's verification section: ~520k alive lines on `/Users/mike/work/store` because we count `package-lock.json` (54k), `drizzle/migrations/meta/*.json` (320k), and other generated files.

**Conventions reminder (from CLAUDE.md):**

- Arrow functions everywhere except generators (`async function*`).
- Folder-pattern (`some-op/index.ts` + `some-op.ts` + `helpers/` + `types/` + `data/`) when an op has several internals.
- One function or class per file. Constants and types co-locate with their single consumer; if shared, move to `data/` or `types/` subfolder.
- Named exports only. Explicit return types on exports. `undefined` over `null`. `interface` for object shapes.
- ESM `.js` extensions in relative imports. No path aliases.
- Colocated tests; `.type.ts` files exempt.
- `npm run lint` (eslint + tsc) and `npm run test:run` are the gates per task.

---

## File structure

### New files

| Path                                                                        | Responsibility                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/internal/filter/is-generated/index.ts`                                 | barrel                                                                             |
| `src/internal/filter/is-generated/is-generated.ts`                          | main `isGenerated` function combining built-in matcher and `.gitattributes` lookup |
| `src/internal/filter/is-generated/is-generated.test.ts`                     | unit tests                                                                         |
| `src/internal/filter/is-generated/data/built-in-patterns.ts`                | constant array of glob patterns                                                    |
| `src/internal/filter/is-generated/helpers/match-built-in-patterns.ts`       | picomatch wrapper that compiles patterns once                                      |
| `src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts`  | unit tests                                                                         |
| `src/internal/filter/is-generated/helpers/parse-gitattributes-line.ts`      | parse one `.gitattributes` line into `{ pattern, attrs }`                          |
| `src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts` | unit tests                                                                         |
| `src/internal/filter/is-generated/helpers/load-gitattributes.ts`            | read `.gitattributes` from disk, return `Map<pattern, attrs>`                      |
| `src/internal/filter/is-generated/helpers/load-gitattributes.test.ts`       | unit tests                                                                         |
| `src/internal/identity/mailmap/index.ts`                                    | barrel                                                                             |
| `src/internal/identity/mailmap/load-mailmap.ts`                             | factory function reading `.mailmap` and returning a `Mailmap`                      |
| `src/internal/identity/mailmap/load-mailmap.test.ts`                        | unit tests                                                                         |
| `src/internal/identity/mailmap/types/mailmap.type.ts`                       | `Mailmap` interface (one method: `canonicalize`)                                   |
| `src/internal/identity/mailmap/helpers/parse-mailmap-line.ts`               | parse one `.mailmap` line into a typed entry                                       |
| `src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts`          | unit tests                                                                         |

### Modified files

| Path                                                  | What changes                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`                   | Add `picomatch` runtime dep                                                                                    |
| `src/types/analyze-options.type.ts`                   | Expand with `include` and `options` sub-objects                                                                |
| `src/internal/identity/aggregator/aggregator.ts`      | Constructor accepts optional `Mailmap`; `recordCommit` and `recordBlameLine` canonicalise via it before keying |
| `src/internal/identity/aggregator/aggregator.test.ts` | New tests for mailmap-aware identity merging                                                                   |
| `src/internal/pipeline/discover.ts`                   | After binary filter, also apply `isGenerated` (when `include.generated === false`)                             |
| `src/internal/pipeline/discover.test.ts`              | New tests covering generated-file exclusion                                                                    |
| `src/internal/pipeline/run-blame-phase.ts`            | Accept `BlameOptions { followRenames, ignoreWhitespace }`, append `-w` / `-M -C` to git args accordingly       |
| `src/internal/pipeline/run-blame-phase.test.ts`       | New tests verifying flags are honoured                                                                         |
| `src/analyze.ts`                                      | Read new options, build mailmap, pass options through to phases                                                |
| `src/analyze.test.ts`                                 | New tests covering filter and mailmap behaviour end-to-end                                                     |

---

## Task 1: Install `picomatch` runtime dependency

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

`picomatch` is the matcher used by both the built-in generated patterns (this plan) and the user-provided glob filter (M4b). Installing it once now keeps the runtime dependency list explicit.

- [ ] **Step 1: Install the package**

```bash
npm install picomatch
```

Expected: `package.json` `dependencies` gains `"picomatch": "^x.y.z"`.

- [ ] **Step 2: Verify the install**

Run: `npm ls --depth=0 --prod`
Expected: existing `cli-table3` and `p-limit` plus the new `picomatch`.

- [ ] **Step 3: Run lint and tests to confirm no regressions**

```bash
npm run lint
npm run test:run
```

Expected: lint exits 0; all 155 existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install picomatch runtime dependency"
```

---

## Task 2: Built-in generated pattern list and matcher

**Files:**

- Create: `src/internal/filter/is-generated/data/built-in-patterns.ts`
- Create: `src/internal/filter/is-generated/helpers/match-built-in-patterns.ts`
- Create: `src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts`

The list covers patterns we know are generated (lock files, build directories, drizzle migration snapshots seen in our dogfood, etc). The matcher compiles them once with `picomatch` and exposes a single boolean check.

- [ ] **Step 1: Create the patterns data file**

Create `src/internal/filter/is-generated/data/built-in-patterns.ts`:

```ts
/**
 * Built-in glob patterns of files that are generated, vendored, or otherwise
 * not meaningful to attribute. Matched against tracked file paths via picomatch
 * with `dot: true` and gitignore-like semantics.
 *
 * Keep this list narrow and well-known. Anything controversial belongs in
 * user-provided `--exclude-globs` (M4b), not here.
 */
export const BUILT_IN_GENERATED_PATTERNS: readonly string[] = [
  // Package manager lock files
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/bun.lockb',
  '**/Gemfile.lock',
  '**/composer.lock',
  '**/Cargo.lock',
  '**/poetry.lock',
  '**/Pipfile.lock',
  '**/go.sum',

  // Minified web assets
  '**/*.min.js',
  '**/*.min.css',
  '**/*.min.html',

  // Source maps
  '**/*.map',
  '**/*.js.map',
  '**/*.css.map',

  // Common build / dist output committed to repos
  'dist/**',
  'build/**',
  'out/**',
  'target/**',
  '.next/**',
  '.nuxt/**',
  '.turbo/**',
  '.vercel/**',
  '.svelte-kit/**',

  // Vendor / third-party drops
  'vendor/**',
  '**/node_modules/**',
  '**/__pycache__/**',
  '**/*.pyc',

  // Generated code
  '**/*.pb.go',
  '**/*.pb.ts',
  '**/*_pb.js',
  '**/*.generated.ts',
  '**/*.gen.ts',
  '**/generated/**',
  '**/__generated__/**',

  // Drizzle ORM (saw 320k lines on the dogfood store repo)
  '**/drizzle/migrations/meta/**',

  // Test snapshots
  '**/__snapshots__/**',
  '**/*.snap',
];
```

- [ ] **Step 2: Write the failing matcher test**

Create `src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchBuiltInPatterns } from './match-built-in-patterns.js';

describe('matchBuiltInPatterns', () => {
  it('matches package-lock.json at repo root', () => {
    expect(matchBuiltInPatterns('package-lock.json')).toBe(true);
  });

  it('matches package-lock.json deep in a subdirectory', () => {
    expect(matchBuiltInPatterns('apps/web/package-lock.json')).toBe(true);
  });

  it('matches drizzle migration meta snapshots', () => {
    expect(matchBuiltInPatterns('drizzle/migrations/meta/0001_snapshot.json')).toBe(true);
  });

  it('matches files inside dist/ at repo root', () => {
    expect(matchBuiltInPatterns('dist/index.js')).toBe(true);
  });

  it('matches minified JavaScript', () => {
    expect(matchBuiltInPatterns('apps/web/public/vendor.min.js')).toBe(true);
  });

  it('does not match a normal source file', () => {
    expect(matchBuiltInPatterns('src/index.ts')).toBe(false);
  });

  it('does not match README.md', () => {
    expect(matchBuiltInPatterns('README.md')).toBe(false);
  });

  it('does not match a .test.ts file', () => {
    expect(matchBuiltInPatterns('src/foo/bar.test.ts')).toBe(false);
  });

  it('matches a .pyc file in any directory', () => {
    expect(matchBuiltInPatterns('app/utils/__pycache__/helpers.pyc')).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement the matcher**

Create `src/internal/filter/is-generated/helpers/match-built-in-patterns.ts`:

```ts
import picomatch from 'picomatch';
import { BUILT_IN_GENERATED_PATTERNS } from '../data/built-in-patterns.js';

const isMatchAnyBuiltIn = picomatch(BUILT_IN_GENERATED_PATTERNS as string[], {
  dot: true,
  nocase: false,
  basename: false,
});

export const matchBuiltInPatterns = (relPath: string): boolean => isMatchAnyBuiltIn(relPath);
```

Note: `picomatch(patternsArray)` returns a single matcher function that checks the path against any of the patterns. `dot: true` ensures dot-prefixed directories like `.next` match.

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts`
Expected: 9 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/internal/filter/is-generated/data src/internal/filter/is-generated/helpers/match-built-in-patterns.ts src/internal/filter/is-generated/helpers/match-built-in-patterns.test.ts
git commit -m "Add built-in generated patterns and picomatch matcher"
```

---

## Task 3: `parseGitattributesLine` helper

**Files:**

- Create: `src/internal/filter/is-generated/helpers/parse-gitattributes-line.ts`
- Create: `src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts`

A `.gitattributes` file uses one of these line shapes (per `git help attributes`):

```
<pattern> <attr1> <attr2> ...
<pattern> <attr>=<value>
# comment
(blank)
```

We only care about `linguist-generated` and `linguist-vendored` for now. The parser returns `null` for blank lines and comments.

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseGitattributesLine } from './parse-gitattributes-line.js';

describe('parseGitattributesLine', () => {
  it('parses a pattern with one boolean attribute', () => {
    expect(parseGitattributesLine('*.lock linguist-generated')).toStrictEqual({
      pattern: '*.lock',
      attrs: { 'linguist-generated': true },
    });
  });

  it('parses a pattern with multiple attributes', () => {
    expect(parseGitattributesLine('vendor/** linguist-vendored linguist-generated')).toStrictEqual({
      pattern: 'vendor/**',
      attrs: { 'linguist-vendored': true, 'linguist-generated': true },
    });
  });

  it('parses an attribute with explicit true value', () => {
    expect(parseGitattributesLine('dist/** linguist-generated=true')).toStrictEqual({
      pattern: 'dist/**',
      attrs: { 'linguist-generated': true },
    });
  });

  it('parses an attribute with explicit false value', () => {
    expect(parseGitattributesLine('important.json linguist-generated=false')).toStrictEqual({
      pattern: 'important.json',
      attrs: { 'linguist-generated': false },
    });
  });

  it('returns null for a blank line', () => {
    expect(parseGitattributesLine('')).toBeNull();
    expect(parseGitattributesLine('   ')).toBeNull();
  });

  it('returns null for a comment line', () => {
    expect(parseGitattributesLine('# this is a comment')).toBeNull();
  });

  it('returns null for a line that has no attributes', () => {
    expect(parseGitattributesLine('only-pattern')).toBeNull();
  });

  it('ignores attributes other than linguist-generated and linguist-vendored', () => {
    expect(parseGitattributesLine('*.txt text eol=lf')).toBeNull();
  });

  it('handles tab as field separator', () => {
    expect(parseGitattributesLine('*.lock\tlinguist-generated')).toStrictEqual({
      pattern: '*.lock',
      attrs: { 'linguist-generated': true },
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/internal/filter/is-generated/helpers/parse-gitattributes-line.ts`:

```ts
export interface ParsedGitattributes {
  pattern: string;
  attrs: { 'linguist-generated'?: boolean; 'linguist-vendored'?: boolean };
}

const KNOWN_ATTRS = ['linguist-generated', 'linguist-vendored'] as const;
type KnownAttr = (typeof KNOWN_ATTRS)[number];

const isKnownAttr = (name: string): name is KnownAttr =>
  (KNOWN_ATTRS as readonly string[]).includes(name);

const parseAttrToken = (token: string): { name: KnownAttr; value: boolean } | null => {
  const eqIndex = token.indexOf('=');
  if (eqIndex === -1) {
    if (!isKnownAttr(token)) {
      return null;
    }
    return { name: token, value: true };
  }
  const name = token.slice(0, eqIndex);
  const rawValue = token.slice(eqIndex + 1);
  if (!isKnownAttr(name)) {
    return null;
  }
  return { name, value: rawValue !== 'false' };
};

export const parseGitattributesLine = (raw: string): ParsedGitattributes | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }

  const pattern = tokens[0] ?? '';
  const attrs: ParsedGitattributes['attrs'] = {};
  let foundKnown = false;

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    const parsed = parseAttrToken(token);
    if (parsed === null) {
      continue;
    }
    attrs[parsed.name] = parsed.value;
    foundKnown = true;
  }

  if (!foundKnown) {
    return null;
  }

  return { pattern, attrs };
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts`
Expected: 9 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/filter/is-generated/helpers/parse-gitattributes-line.ts src/internal/filter/is-generated/helpers/parse-gitattributes-line.test.ts
git commit -m "Add parseGitattributesLine for linguist attribute extraction"
```

---

## Task 4: `loadGitattributes` helper

**Files:**

- Create: `src/internal/filter/is-generated/helpers/load-gitattributes.ts`
- Create: `src/internal/filter/is-generated/helpers/load-gitattributes.test.ts`

Reads `.gitattributes` from the repo root, parses every line via `parseGitattributesLine`, returns a `Map<pattern, attrs>`. If the file does not exist, returns an empty map (most repos have no `.gitattributes`).

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/is-generated/helpers/load-gitattributes.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadGitattributes } from './load-gitattributes.js';

describe('loadGitattributes', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeRepoWithGitattributes = (content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-attrs-'));
    created.push(dir);
    writeFileSync(join(dir, '.gitattributes'), content, 'utf8');
    return dir;
  };

  it('returns an empty map when .gitattributes does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-no-attrs-'));
    created.push(dir);
    const result = loadGitattributes(dir);
    expect(result.size).toBe(0);
  });

  it('returns a map keyed by pattern when .gitattributes has linguist attributes', () => {
    const dir = makeRepoWithGitattributes(
      [
        '# comment',
        '',
        '*.lock linguist-generated',
        'vendor/** linguist-vendored',
        'src/** text eol=lf',
      ].join('\n'),
    );
    const result = loadGitattributes(dir);
    expect(result.size).toBe(2);
    expect(result.get('*.lock')).toEqual({ 'linguist-generated': true });
    expect(result.get('vendor/**')).toEqual({ 'linguist-vendored': true });
    expect(result.has('src/**')).toBe(false);
  });

  it('handles a file with only comments and blank lines', () => {
    const dir = makeRepoWithGitattributes('# nothing\n\n   \n');
    const result = loadGitattributes(dir);
    expect(result.size).toBe(0);
  });

  it('respects explicit false values', () => {
    const dir = makeRepoWithGitattributes('important.json linguist-generated=false');
    const result = loadGitattributes(dir);
    expect(result.get('important.json')).toEqual({ 'linguist-generated': false });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-generated/helpers/load-gitattributes.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the loader**

Create `src/internal/filter/is-generated/helpers/load-gitattributes.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGitattributesLine, type ParsedGitattributes } from './parse-gitattributes-line.js';

export type GitattributesMap = Map<string, ParsedGitattributes['attrs']>;

export const loadGitattributes = (repoRoot: string): GitattributesMap => {
  const path = join(repoRoot, '.gitattributes');
  if (!existsSync(path)) {
    return new Map();
  }

  const content = readFileSync(path, 'utf8');
  const map: GitattributesMap = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseGitattributesLine(rawLine);
    if (parsed === null) {
      continue;
    }
    map.set(parsed.pattern, parsed.attrs);
  }

  return map;
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-generated/helpers/load-gitattributes.test.ts`
Expected: 4 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/filter/is-generated/helpers/load-gitattributes.ts src/internal/filter/is-generated/helpers/load-gitattributes.test.ts
git commit -m "Add loadGitattributes file reader and parser"
```

---

## Task 5: `isGenerated` main function

**Files:**

- Create: `src/internal/filter/is-generated/is-generated.ts`
- Create: `src/internal/filter/is-generated/is-generated.test.ts`
- Create: `src/internal/filter/is-generated/index.ts`

Combines the built-in matcher and the gitattributes map. A path is "generated" if either the built-in matcher returns true, or if a `.gitattributes` pattern that matches it has `linguist-generated: true` or `linguist-vendored: true`. An explicit `linguist-generated: false` overrides the built-in match (allowing repos to whitelist specific lock files for analysis).

- [ ] **Step 1: Write the failing test**

Create `src/internal/filter/is-generated/is-generated.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { isGenerated } from './is-generated.js';

const noAttrs: GitattributesMap = new Map();

describe('isGenerated', () => {
  it('returns true for a built-in pattern (lock file) with no gitattributes', () => {
    expect(isGenerated('package-lock.json', noAttrs)).toBe(true);
  });

  it('returns false for a normal source file with no gitattributes', () => {
    expect(isGenerated('src/index.ts', noAttrs)).toBe(false);
  });

  it('returns true for a path matched by a linguist-generated gitattributes entry', () => {
    const attrs: GitattributesMap = new Map([['*.proto', { 'linguist-generated': true }]]);
    expect(isGenerated('schemas/user.proto', attrs)).toBe(true);
  });

  it('returns true for a path matched by a linguist-vendored gitattributes entry', () => {
    const attrs: GitattributesMap = new Map([['third-party/**', { 'linguist-vendored': true }]]);
    expect(isGenerated('third-party/foo/bar.js', attrs)).toBe(true);
  });

  it('lets gitattributes linguist-generated=false override a built-in match', () => {
    const attrs: GitattributesMap = new Map([
      ['package-lock.json', { 'linguist-generated': false }],
    ]);
    expect(isGenerated('package-lock.json', attrs)).toBe(false);
  });

  it('returns false when no built-in match and no relevant gitattributes', () => {
    const attrs: GitattributesMap = new Map([['*.md', { 'linguist-vendored': false }]]);
    expect(isGenerated('README.md', attrs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/filter/is-generated/is-generated.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `isGenerated`**

Create `src/internal/filter/is-generated/is-generated.ts`:

```ts
import picomatch from 'picomatch';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { matchBuiltInPatterns } from './helpers/match-built-in-patterns.js';

const checkGitattributes = (relPath: string, attrs: GitattributesMap): boolean | null => {
  for (const [pattern, attrValues] of attrs) {
    const isMatch = picomatch(pattern, { dot: true });
    if (!isMatch(relPath)) {
      continue;
    }
    if (attrValues['linguist-generated'] === false) {
      return false;
    }
    if (attrValues['linguist-vendored'] === false) {
      return false;
    }
    if (attrValues['linguist-generated'] === true || attrValues['linguist-vendored'] === true) {
      return true;
    }
  }
  return null;
};

export const isGenerated = (relPath: string, attrs: GitattributesMap): boolean => {
  const explicit = checkGitattributes(relPath, attrs);
  if (explicit !== null) {
    return explicit;
  }
  return matchBuiltInPatterns(relPath);
};
```

Note: `gitattributes` takes precedence over the built-in list — if the user explicitly says `linguist-generated=false`, we honour it. This satisfies the spec rule "every default is overridable".

- [ ] **Step 4: Create the barrel**

Create `src/internal/filter/is-generated/index.ts`:

```ts
export { isGenerated } from './is-generated.js';
export { loadGitattributes, type GitattributesMap } from './helpers/load-gitattributes.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/filter/is-generated/is-generated.test.ts`
Expected: 6 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/internal/filter/is-generated/is-generated.ts src/internal/filter/is-generated/is-generated.test.ts src/internal/filter/is-generated/index.ts
git commit -m "Add isGenerated combining built-in patterns and gitattributes"
```

---

## Task 6: Expand `AnalyzeOptions` with `include` and `options` sub-objects

**Files:**

- Modify: `src/types/analyze-options.type.ts`

Per spec §2 the full `AnalyzeOptions` interface has nested `include` and `options` sub-objects controlling each filter and algorithmic flag. M3 only had `path`. M4a adds the four fields it needs (`include.binary`, `include.generated`, `options.followRenames`, `options.applyMailmap`, plus `options.ignoreWhitespace`). M4b will add the rest (`include.minified`, `includeGlobs`, `excludeGlobs`).

Defaults follow spec §1: every filter is on, mailmap is on, renames are followed, whitespace is ignored.

- [ ] **Step 1: Replace the file**

Replace `src/types/analyze-options.type.ts` with this exact content:

```ts
export interface AnalyzeOptions {
  /** Absolute path to the repository root. Required. */
  path: string;

  /** Filters that decide which files and lines to count. Defaults exclude noise. */
  include?: {
    /** Include lines that consist only of whitespace. Default: false. */
    whitespace?: boolean;
    /** Include binary files. Default: false. */
    binary?: boolean;
    /** Include generated files (lock files, build output, linguist-generated). Default: false. */
    generated?: boolean;
  };

  /** Algorithmic options that change how the analysis is performed. */
  options?: {
    /** Pass `-M -C` to git blame to follow renames and copies. Default: true. */
    followRenames?: boolean;
    /** Apply the repository's `.mailmap` to canonicalise author identities. Default: true. */
    applyMailmap?: boolean;
  };
}
```

Note: `whitespace` is grouped under `include` because conceptually a whitespace-only line is a kind of content the user can choose to include or not. The blame `-w` flag is the mechanism, but the user-facing decision is "do whitespace-only lines count as code?".

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exits 0. The type-only change ripples through other files but no behavioural code uses these new fields yet.

- [ ] **Step 3: Run the existing test suite**

Run: `npm run test:run`
Expected: all 155 tests still pass. The shape change is backward compatible because every new field is optional.

- [ ] **Step 4: Commit**

```bash
git add src/types/analyze-options.type.ts
git commit -m "Expand AnalyzeOptions with include and options sub-objects"
```

---

## Task 7: Integrate `isGenerated` into `discover` phase

**Files:**

- Modify: `src/internal/pipeline/discover.ts`
- Modify: `src/internal/pipeline/discover.test.ts`

`discover` already filters binaries. Add a parallel filter for generated files. The phase needs to know whether the user disabled the generated filter (via `include.generated: true` in `AnalyzeOptions`).

Per the spec, `discover()` accepts the full repo context. We extend its signature to take an `includeGenerated` boolean (default `false` — exclude generated). The orchestrator (`analyze.ts`) reads `options.include?.generated` and passes it down.

- [ ] **Step 1: Add new failing tests**

Open `src/internal/pipeline/discover.test.ts` and add these tests inside the existing `describe('discover', ...)` block, after the existing cases:

```ts
it('filters out package-lock.json from the result', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <a@x>',
      date: '2024-01-01T00:00:00Z',
      files: {
        'a.txt': 'hello\n',
        'package-lock.json': '{ "name": "test", "lockfileVersion": 3, "packages": {} }\n',
      },
    },
  ]);
  createdRepos.push(dir);

  const result = await discover(dir, { includeGenerated: false });

  expect(result.files.sort()).toEqual(['a.txt']);
});

it('keeps package-lock.json when includeGenerated is true', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <a@x>',
      date: '2024-01-01T00:00:00Z',
      files: {
        'a.txt': 'hello\n',
        'package-lock.json': '{ "name": "test", "lockfileVersion": 3, "packages": {} }\n',
      },
    },
  ]);
  createdRepos.push(dir);

  const result = await discover(dir, { includeGenerated: true });

  expect(result.files.sort()).toEqual(['a.txt', 'package-lock.json']);
});

it('honours .gitattributes linguist-generated=false to whitelist a built-in pattern', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <a@x>',
      date: '2024-01-01T00:00:00Z',
      files: {
        'a.txt': 'hello\n',
        'package-lock.json': '{ "name": "test", "lockfileVersion": 3, "packages": {} }\n',
        '.gitattributes': 'package-lock.json linguist-generated=false\n',
      },
    },
  ]);
  createdRepos.push(dir);

  const result = await discover(dir, { includeGenerated: false });

  expect(result.files.sort()).toEqual(['.gitattributes', 'a.txt', 'package-lock.json']);
});
```

You also need to update the existing tests so that they pass `{ includeGenerated: true }` (or equivalent) to `discover`, since the signature now requires the second argument. Find every existing call to `discover(dir)` in the file and change it to `discover(dir, { includeGenerated: false })` — except the empty-repo and non-git tests which should also use that. Let the new generated-filter tests above explicitly use `false` and `true` to demonstrate both branches.

Concretely, update the four existing tests:

- "returns the HEAD sha and tracked file list..." → `discover(dir, { includeGenerated: false })`
- "filters out files with NUL bytes (binary)" → same
- "throws NotAGitRepoError for a non-git directory" → same
- "returns an empty files list for an empty repo" → same

- [ ] **Step 2: Run tests, verify only the new tests fail**

Run: `npx vitest run src/internal/pipeline/discover.test.ts`
Expected: the existing 4 tests still pass (they call the new signature), the 3 new tests fail because `discover` does not yet apply the generated filter.

- [ ] **Step 3: Update `discover.ts`**

Replace the contents of `src/internal/pipeline/discover.ts` with this exact code:

```ts
import { join } from 'node:path';
import { NotAGitRepoError } from '../../errors/not-a-git-repo.error.js';
import { isBinary } from '../filter/is-binary/index.js';
import { isGenerated, loadGitattributes } from '../filter/is-generated/index.js';
import { isGitRepo } from '../git/is-git-repo.js';
import { listTrackedFiles } from '../git/list-tracked-files.js';
import { resolveRev } from '../git/resolve-rev.js';
import type { Warning } from '../../types/warning.type.js';

export interface DiscoverOptions {
  includeGenerated: boolean;
}

export interface DiscoverResult {
  headSha: string;
  headRef: string;
  files: string[];
  warnings: Warning[];
}

export const discover = async (cwd: string, options: DiscoverOptions): Promise<DiscoverResult> => {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  const headSha = await resolveRev(cwd, 'HEAD').catch(() => '');
  const allFiles = await listTrackedFiles(cwd);
  const gitattributes = options.includeGenerated ? new Map() : loadGitattributes(cwd);
  const warnings: Warning[] = [];
  const survivingFiles: string[] = [];

  for (const relPath of allFiles) {
    if (!options.includeGenerated && isGenerated(relPath, gitattributes)) {
      warnings.push({
        code: 'FILE_SKIPPED_GENERATED',
        file: relPath,
        message: `${relPath} is generated; excluded from analysis`,
      });
      continue;
    }

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
      survivingFiles.push(relPath);
    } catch {
      // File may not exist on disk (dangling symlink, etc). Skip silently.
    }
  }

  return {
    headSha,
    headRef: 'HEAD',
    files: survivingFiles,
    warnings,
  };
};
```

Note: when `includeGenerated` is `true` we skip both the gitattributes load and the `isGenerated` check entirely — that path is now zero-overhead for users who opt in.

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/internal/pipeline/discover.test.ts`
Expected: all 7 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0. Note: `analyze.ts` will not yet compile because it still calls `discover(options.path)` without the second argument. That is fixed in Task 9. To prevent transient breakage, the lint may fail here — if it does, proceed to Task 9 immediately.

If lint fails specifically because `analyze.ts` no longer compiles, that is expected. Make a note in the commit message and fix in Task 9. If lint is otherwise broken (in `discover.ts` or its tests), stop and investigate.

- [ ] **Step 6: Commit (even with broken lint, since the repair lands in Task 9)**

```bash
git add src/internal/pipeline/discover.ts src/internal/pipeline/discover.test.ts
git commit -m "Apply isGenerated filter inside discover phase"
```

If the pre-commit hook blocks because lint fails, run the same `git commit` with `--no-verify` IS NOT ALLOWED — instead, jump straight into Task 9 (and Task 8 below) and group their commits together. The simplest path is to do Tasks 7, 8, and 9 in a single working session and only commit after Task 9 makes the orchestrator compile again.

**Pragmatic note:** the cleanest sequence is to combine Tasks 7, 8, and 9 into a single transactional change so the working tree never has a broken intermediate state. The plan presents them separately for clarity, but the implementer should feel free to defer the commit at the end of Task 7 until Task 9 is complete.

---

## Task 8: Apply `-w` and `-M -C` flags in `runBlamePhase`

**Files:**

- Modify: `src/internal/pipeline/run-blame-phase.ts`
- Modify: `src/internal/pipeline/run-blame-phase.test.ts`

`runBlamePhase` currently runs `git blame --line-porcelain HEAD -- <file>` for every file. Add an options object with `followRenames` and `ignoreWhitespace`, defaulting both to `true`. Append `-M`, `-C` if `followRenames`. Append `-w` if `ignoreWhitespace`.

- [ ] **Step 1: Add new failing tests**

Open `src/internal/pipeline/run-blame-phase.test.ts` and add these tests inside the existing `describe('runBlamePhase', ...)` block, after the existing cases:

```ts
it('attributes whitespace-only edits to the original author when ignoreWhitespace is true', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@example.com>',
      date: '2024-01-01T00:00:00Z',
      files: { 'a.txt': 'function foo() {\n  return 42;\n}\n' },
    },
    {
      author: 'Whitespace Bot <ws@example.com>',
      date: '2024-01-02T00:00:00Z',
      // Same content with extra blank line + trailing whitespace — purely cosmetic
      files: { 'a.txt': 'function foo() {\n    return 42;   \n}\n' },
    },
  ]);
  createdRepos.push(dir);

  const agg = new Aggregator();
  await runBlamePhase(dir, ['a.txt'], agg, { followRenames: true, ignoreWhitespace: true });

  const stats = agg.getStatsForTesting();
  // All 3 lines should still be attributed to Alice because the only difference
  // between her version and the bot's is whitespace.
  expect(stats.get('alice@example.com')?.linesAlive).toBe(3);
  expect(stats.get('ws@example.com')?.linesAlive ?? 0).toBe(0);
});

it('attributes whitespace edits to the bot when ignoreWhitespace is false', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@example.com>',
      date: '2024-01-01T00:00:00Z',
      files: { 'a.txt': 'function foo() {\n  return 42;\n}\n' },
    },
    {
      author: 'Whitespace Bot <ws@example.com>',
      date: '2024-01-02T00:00:00Z',
      files: { 'a.txt': 'function foo() {\n    return 42;   \n}\n' },
    },
  ]);
  createdRepos.push(dir);

  const agg = new Aggregator();
  await runBlamePhase(dir, ['a.txt'], agg, { followRenames: true, ignoreWhitespace: false });

  const stats = agg.getStatsForTesting();
  expect(
    (stats.get('ws@example.com')?.linesAlive ?? 0) +
      (stats.get('alice@example.com')?.linesAlive ?? 0),
  ).toBe(3);
  expect(stats.get('ws@example.com')?.linesAlive).toBeGreaterThan(0);
});

it('follows renames when followRenames is true', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = buildRepo([
    {
      author: 'Alice <alice@example.com>',
      date: '2024-01-01T00:00:00Z',
      files: { 'old.txt': 'line one\nline two\nline three\n' },
    },
  ]);
  createdRepos.push(dir);

  // Rename without modifying content
  spawnSync('git', ['mv', 'old.txt', 'new.txt'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'rename old to new'], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
      GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
      GIT_AUTHOR_NAME: 'Mover',
      GIT_AUTHOR_EMAIL: 'mover@example.com',
      GIT_COMMITTER_NAME: 'Mover',
      GIT_COMMITTER_EMAIL: 'mover@example.com',
    },
  });

  const agg = new Aggregator();
  await runBlamePhase(dir, ['new.txt'], agg, { followRenames: true, ignoreWhitespace: true });

  const stats = agg.getStatsForTesting();
  // All 3 lines should be Alice's because the rename did not change content
  expect(stats.get('alice@example.com')?.linesAlive).toBe(3);
  expect(stats.get('mover@example.com')?.linesAlive ?? 0).toBe(0);
});
```

You also need to update the existing tests to pass the new options object. Find every call to `runBlamePhase(dir, files, agg)` in the existing tests and change it to `runBlamePhase(dir, files, agg, { followRenames: true, ignoreWhitespace: true })`.

- [ ] **Step 2: Run tests, verify only the new tests fail**

Run: `npx vitest run src/internal/pipeline/run-blame-phase.test.ts`
Expected: existing 4 tests (after updating their signature) still pass; the 3 new tests fail because `runBlamePhase` ignores the new options.

- [ ] **Step 3: Update `runBlamePhase`**

Replace the contents of `src/internal/pipeline/run-blame-phase.ts` with:

```ts
import { cpus } from 'node:os';
import pLimit from 'p-limit';
import { spawnGit } from '../git/spawn-git.js';
import { parseBlamePorcelain } from '../parse/parse-blame-porcelain/index.js';
import type { Aggregator } from '../identity/aggregator/index.js';

export interface BlameOptions {
  followRenames: boolean;
  ignoreWhitespace: boolean;
}

const buildBlameArgs = (file: string, options: BlameOptions): string[] => {
  const args = ['blame', '--line-porcelain'];
  if (options.followRenames) {
    args.push('-M', '-C');
  }
  if (options.ignoreWhitespace) {
    args.push('-w');
  }
  args.push('HEAD', '--', file);
  return args;
};

const blameOneFile = async (
  cwd: string,
  file: string,
  aggregator: Aggregator,
  options: BlameOptions,
): Promise<void> => {
  try {
    const result = spawnGit(buildBlameArgs(file, options), cwd);
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
  options: BlameOptions,
): Promise<void> => {
  if (files.length === 0) {
    return;
  }
  const limit = pLimit(Math.max(1, cpus().length));
  await Promise.all(files.map((file) => limit(() => blameOneFile(cwd, file, aggregator, options))));
};
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/internal/pipeline/run-blame-phase.test.ts`
Expected: all 7 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0 OR fails because `analyze.ts` still calls `runBlamePhase` with the old 3-arg signature. Same as Task 7 — fix lands in Task 9.

- [ ] **Step 6: Commit (or defer to Task 9 — see Task 7 note)**

```bash
git add src/internal/pipeline/run-blame-phase.ts src/internal/pipeline/run-blame-phase.test.ts
git commit -m "Add followRenames and ignoreWhitespace options to runBlamePhase"
```

---

## Task 9: Thread options through `analyze()`

**Files:**

- Modify: `src/analyze.ts`
- Modify: `src/analyze.test.ts`

`analyze()` reads `AnalyzeOptions` and routes the right pieces to `discover` and `runBlamePhase`. Defaults match spec §1: filters on, mailmap on, renames followed, whitespace ignored. After this task, the working tree compiles cleanly again.

- [ ] **Step 1: Replace `analyze.ts`**

Replace the contents of `src/analyze.ts` with:

```ts
import { Aggregator } from './internal/identity/aggregator/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

const resolveDefaults = (options: AnalyzeOptions) => ({
  includeGenerated: options.include?.generated ?? false,
  ignoreWhitespace: !(options.include?.whitespace ?? false),
  followRenames: options.options?.followRenames ?? true,
});

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  const startedAt = new Date();
  const startMs = Date.now();
  const resolved = resolveDefaults(options);

  const discovered = await discover(options.path, {
    includeGenerated: resolved.includeGenerated,
  });
  const aggregator = new Aggregator();

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  await Promise.all([
    runLogPhase(options.path, aggregator),
    runBlamePhase(options.path, discovered.files, aggregator, {
      followRenames: resolved.followRenames,
      ignoreWhitespace: resolved.ignoreWhitespace,
    }),
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

Note the inversion: the user-facing `include.whitespace` is `true` to count whitespace lines, which means we pass `ignoreWhitespace: false` to git blame. The `resolveDefaults` helper centralises that mapping.

- [ ] **Step 2: Add a new failing test for the generated filter at the end-to-end level**

Open `src/analyze.test.ts` and add this test inside the existing `describe('analyze', ...)` block, after the existing cases:

```ts
it('excludes generated files (lock files) by default', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@example.com>',
      date: '2024-01-01T00:00:00Z',
      files: {
        'a.txt': 'real code\n',
        'package-lock.json': '{ "name": "x", "lockfileVersion": 3, "packages": {} }\n',
      },
    },
  ]);
  createdRepos.push(dir);

  const report = await analyze({ path: dir });

  // package-lock.json should not contribute to linesAlive
  const alice = report.authors.find((a) => a.email === 'alice@example.com');
  expect(alice?.linesAlive).toBe(1);
  expect(report.warnings.some((w) => w.code === 'FILE_SKIPPED_GENERATED')).toBe(true);
});

it('includes generated files when include.generated is true', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@example.com>',
      date: '2024-01-01T00:00:00Z',
      files: {
        'a.txt': 'real code\n',
        'package-lock.json': '{ "name": "x", "lockfileVersion": 3, "packages": {} }\n',
      },
    },
  ]);
  createdRepos.push(dir);

  const report = await analyze({
    path: dir,
    include: { generated: true },
  });

  const alice = report.authors.find((a) => a.email === 'alice@example.com');
  // Both files now counted
  expect(alice?.linesAlive).toBeGreaterThan(1);
});
```

- [ ] **Step 3: Run tests, verify all pass**

Run: `npx vitest run src/analyze.test.ts`
Expected: existing 3 + 2 new = 5 tests green.

- [ ] **Step 4: Run the full suite to confirm nothing else broke**

Run: `npm run test:run`
Expected: all tests pass — 155 (existing) + new tests added in Tasks 2–9.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit (this also retroactively cleans up the deferred commits from Tasks 7–8)**

```bash
git add src/analyze.ts src/analyze.test.ts
git commit -m "Thread filter and blame options through analyze()"
```

(If you deferred the Tasks 7 and 8 commits per the pragmatic note, those changes land here too — adjust the `git add` command and commit message accordingly. A reasonable consolidated message: `Add generated filter and blame correctness options across the pipeline`.)

---

## Task 10: `parseMailmapLine` helper

**Files:**

- Create: `src/internal/identity/mailmap/types/mailmap.type.ts`
- Create: `src/internal/identity/mailmap/helpers/parse-mailmap-line.ts`
- Create: `src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts`

The `.mailmap` file (`git help mailmap`) supports four line shapes:

```
<Proper Name> <commit@email.xx>
<Proper Name> <proper@email.xx> <commit@email.xx>
<proper@email.xx> <commit@email.xx>
<Proper Name> <proper@email.xx> <Commit Name> <commit@email.xx>
```

Plus comments (`#`) and blank lines. The parser turns each non-empty line into a typed entry that the canonicalizer can index.

- [ ] **Step 1: Create the type file**

Create `src/internal/identity/mailmap/types/mailmap.type.ts`:

```ts
export interface MailmapEntry {
  /** The proper canonical identity to substitute. */
  proper: { name: string; email: string };
  /** The commit-side identity to match against (key in lookup). */
  commit: { name: string | undefined; email: string };
}

export interface Mailmap {
  /**
   * Returns the canonical (name, email) for a given commit identity.
   * If no entry matches, returns the input unchanged.
   */
  canonicalize(name: string, email: string): { name: string; email: string };
}
```

- [ ] **Step 2: Write the failing test for `parseMailmapLine`**

Create `src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseMailmapLine } from './parse-mailmap-line.js';

describe('parseMailmapLine', () => {
  it('parses form 1: proper name + commit email', () => {
    const result = parseMailmapLine('Alice Smith <alice@x>');
    expect(result).toStrictEqual({
      proper: { name: 'Alice Smith', email: 'alice@x' },
      commit: { name: undefined, email: 'alice@x' },
    });
  });

  it('parses form 2: proper name + proper email + commit email', () => {
    const result = parseMailmapLine('Alice Smith <alice@new> <alice@old>');
    expect(result).toStrictEqual({
      proper: { name: 'Alice Smith', email: 'alice@new' },
      commit: { name: undefined, email: 'alice@old' },
    });
  });

  it('parses form 3: proper email + commit email (no name)', () => {
    const result = parseMailmapLine('<alice@new> <alice@old>');
    expect(result).toStrictEqual({
      proper: { name: '', email: 'alice@new' },
      commit: { name: undefined, email: 'alice@old' },
    });
  });

  it('parses form 4: proper name + proper email + commit name + commit email', () => {
    const result = parseMailmapLine('Alice Smith <alice@new> ali <alice@old>');
    expect(result).toStrictEqual({
      proper: { name: 'Alice Smith', email: 'alice@new' },
      commit: { name: 'ali', email: 'alice@old' },
    });
  });

  it('returns null for a blank line', () => {
    expect(parseMailmapLine('')).toBeNull();
    expect(parseMailmapLine('   ')).toBeNull();
  });

  it('returns null for a comment line', () => {
    expect(parseMailmapLine('# comment')).toBeNull();
  });

  it('returns null for a line with no email', () => {
    expect(parseMailmapLine('Just a name')).toBeNull();
  });

  it('handles names with multiple words', () => {
    const result = parseMailmapLine('Alice von Trapp <alice@x>');
    expect(result?.proper.name).toBe('Alice von Trapp');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement the parser**

Create `src/internal/identity/mailmap/helpers/parse-mailmap-line.ts`:

```ts
import type { MailmapEntry } from '../types/mailmap.type.js';

interface NameEmail {
  name: string;
  email: string;
}

const extractEmails = (line: string): { emails: string[]; cleaned: string } => {
  const emails: string[] = [];
  const cleaned = line.replace(/<([^>]+)>/g, (_match, captured: string) => {
    emails.push(captured);
    return '\u0000';
  });
  return { emails, cleaned };
};

const parseSegments = (cleaned: string): string[] =>
  cleaned.split('\u0000').map((segment) => segment.trim());

const buildIdentity = (name: string, email: string): NameEmail => ({ name, email });

export const parseMailmapLine = (raw: string): MailmapEntry | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return null;
  }

  const { emails, cleaned } = extractEmails(trimmed);
  if (emails.length === 0) {
    return null;
  }

  const segments = parseSegments(cleaned);

  // Form 1: "Proper Name <email>" → segments: ["Proper Name", ""]
  if (emails.length === 1) {
    const properName = segments[0] ?? '';
    const email = emails[0] ?? '';
    return {
      proper: buildIdentity(properName, email),
      commit: { name: undefined, email },
    };
  }

  // Forms 2/3/4: two emails
  const properEmail = emails[0] ?? '';
  const commitEmail = emails[1] ?? '';
  const properName = segments[0] ?? '';
  const commitName = segments[1] ?? '';

  return {
    proper: buildIdentity(properName, properEmail),
    commit: {
      name: commitName.length > 0 ? commitName : undefined,
      email: commitEmail,
    },
  };
};
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts`
Expected: 8 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/internal/identity/mailmap/types src/internal/identity/mailmap/helpers/parse-mailmap-line.ts src/internal/identity/mailmap/helpers/parse-mailmap-line.test.ts
git commit -m "Add parseMailmapLine for the four mailmap line forms"
```

---

## Task 11: `loadMailmap` factory function

**Files:**

- Create: `src/internal/identity/mailmap/load-mailmap.ts`
- Create: `src/internal/identity/mailmap/load-mailmap.test.ts`
- Create: `src/internal/identity/mailmap/index.ts`

`loadMailmap(repoRoot)` reads `.mailmap` from the repo root, parses every line, and returns a `Mailmap` object with a `canonicalize` method.

**Lookup rules:** when canonicalising `(name, email)`, look up entries in this order:

1. Exact match on `(commit.name, commit.email)` — most specific
2. Match on `commit.email` only — most common
3. No match → return input unchanged

If no `.mailmap` exists, return an identity canonicalizer (returns input unchanged).

- [ ] **Step 1: Write the failing test**

Create `src/internal/identity/mailmap/load-mailmap.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMailmap } from './load-mailmap.js';

describe('loadMailmap', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  const makeRepoWithMailmap = (content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-mm-'));
    created.push(dir);
    writeFileSync(join(dir, '.mailmap'), content, 'utf8');
    return dir;
  };

  it('returns identity canonicalizer when .mailmap does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-no-mm-'));
    created.push(dir);
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('Alice', 'alice@x')).toEqual({ name: 'Alice', email: 'alice@x' });
  });

  it('canonicalizes by email-only match', () => {
    const dir = makeRepoWithMailmap('Alice Canonical <alice@new> <alice@old>\n');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('Alice', 'alice@old')).toEqual({
      name: 'Alice Canonical',
      email: 'alice@new',
    });
  });

  it('returns input unchanged when no entry matches', () => {
    const dir = makeRepoWithMailmap('Alice Canonical <alice@new> <alice@old>\n');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('Bob', 'bob@x')).toEqual({ name: 'Bob', email: 'bob@x' });
  });

  it('honours the most specific entry first (name+email over email-only)', () => {
    const content = [
      'Generic Alice <alice@new> <alice@old>',
      'Specific Alice <alice@new> ali <alice@old>',
    ].join('\n');
    const dir = makeRepoWithMailmap(content);
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('ali', 'alice@old')).toEqual({
      name: 'Specific Alice',
      email: 'alice@new',
    });
    expect(mailmap.canonicalize('Anyone Else', 'alice@old')).toEqual({
      name: 'Generic Alice',
      email: 'alice@new',
    });
  });

  it('handles form 1 (name + email only) as a name correction for that email', () => {
    const dir = makeRepoWithMailmap('Alice Canonical <alice@x>\n');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('alice', 'alice@x')).toEqual({
      name: 'Alice Canonical',
      email: 'alice@x',
    });
  });

  it('skips comment and blank lines', () => {
    const content = [
      '# header comment',
      '',
      'Alice Canonical <alice@new> <alice@old>',
      '',
      '# trailing comment',
    ].join('\n');
    const dir = makeRepoWithMailmap(content);
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('whatever', 'alice@old').name).toBe('Alice Canonical');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/internal/identity/mailmap/load-mailmap.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `loadMailmap`**

Create `src/internal/identity/mailmap/load-mailmap.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMailmapLine } from './helpers/parse-mailmap-line.js';
import type { Mailmap, MailmapEntry } from './types/mailmap.type.js';

const buildSpecificKey = (name: string, email: string): string => `${name}\x00${email}`;

const identityMailmap: Mailmap = {
  canonicalize: (name, email) => ({ name, email }),
};

export const loadMailmap = (repoRoot: string): Mailmap => {
  const path = join(repoRoot, '.mailmap');
  if (!existsSync(path)) {
    return identityMailmap;
  }

  const content = readFileSync(path, 'utf8');
  const specific = new Map<string, MailmapEntry>();
  const byEmail = new Map<string, MailmapEntry>();

  for (const rawLine of content.split(/\r?\n/)) {
    const entry = parseMailmapLine(rawLine);
    if (entry === null) {
      continue;
    }
    if (entry.commit.name !== undefined) {
      specific.set(buildSpecificKey(entry.commit.name, entry.commit.email), entry);
    } else {
      byEmail.set(entry.commit.email, entry);
    }
  }

  return {
    canonicalize: (name, email) => {
      const specificMatch = specific.get(buildSpecificKey(name, email));
      if (specificMatch !== undefined) {
        return { name: specificMatch.proper.name, email: specificMatch.proper.email };
      }
      const emailMatch = byEmail.get(email);
      if (emailMatch !== undefined) {
        return {
          name: emailMatch.proper.name.length > 0 ? emailMatch.proper.name : name,
          email: emailMatch.proper.email,
        };
      }
      return { name, email };
    },
  };
};
```

- [ ] **Step 4: Create the barrel**

Create `src/internal/identity/mailmap/index.ts`:

```ts
export { loadMailmap } from './load-mailmap.js';
export type { Mailmap, MailmapEntry } from './types/mailmap.type.js';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/internal/identity/mailmap/load-mailmap.test.ts`
Expected: 6 cases green.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/internal/identity/mailmap
git commit -m "Add loadMailmap with specific and email-only canonicalisation"
```

---

## Task 12: Integrate `Mailmap` into `Aggregator`

**Files:**

- Modify: `src/internal/identity/aggregator/aggregator.ts`
- Modify: `src/internal/identity/aggregator/aggregator.test.ts`

`Aggregator` accepts an optional `Mailmap` in its constructor. Both `recordCommit` and `recordBlameLine` canonicalise the incoming `(name, email)` via the mailmap before keying. When no mailmap is provided, behaviour is unchanged.

- [ ] **Step 1: Add new failing test**

Open `src/internal/identity/aggregator/aggregator.test.ts` and add this new `describe` block at the top level (after the existing ones, before the closing of the file):

```ts
describe('Aggregator with mailmap', () => {
  const fixedMailmap: import('../mailmap/index.js').Mailmap = {
    canonicalize: (name, email) => {
      if (email === 'alice@old') {
        return { name: 'Alice Canonical', email: 'alice@new' };
      }
      return { name, email };
    },
  };

  it('merges entries that the mailmap canonicalises to the same email', () => {
    const agg = new Aggregator(fixedMailmap);
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@old',
        files: [{ path: 'a.txt', added: 5, deleted: 0 }],
      }),
    );
    agg.recordCommit(
      makeLogCommit({
        authorName: 'Alice',
        authorMail: 'alice@new',
        files: [{ path: 'b.txt', added: 3, deleted: 0 }],
      }),
    );

    const stats = agg.getStatsForTesting();
    // Both commits should land under the canonical email
    expect(stats.size).toBe(1);
    const alice = stats.get('alice@new');
    expect(alice?.linesAdded).toBe(8);
    expect(alice?.commits).toBe(2);
    expect(alice?.name).toBe('Alice Canonical');
  });

  it('canonicalises blame lines too', () => {
    const agg = new Aggregator(fixedMailmap);
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@old' }));
    agg.recordBlameLine(makeBlameLine({ authorMail: 'alice@new' }));

    const stats = agg.getStatsForTesting();
    expect(stats.size).toBe(1);
    expect(stats.get('alice@new')?.linesAlive).toBe(2);
  });

  it('falls back to identity behaviour when no mailmap is provided', () => {
    const agg = new Aggregator();
    agg.recordCommit(makeLogCommit({ authorName: 'Alice', authorMail: 'alice@old' }));
    agg.recordCommit(makeLogCommit({ authorName: 'Alice', authorMail: 'alice@new' }));
    expect(agg.getStatsForTesting().size).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: 11 existing tests pass, 3 new tests fail because the constructor doesn't accept a mailmap.

- [ ] **Step 3: Update `Aggregator`**

Replace the contents of `src/internal/identity/aggregator/aggregator.ts` with this exact code:

```ts
import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { AuthorStats } from '../../../types/author-stats.type.js';
import type { Report } from '../../../types/report.type.js';
import type { Warning } from '../../../types/warning.type.js';
import type { Mailmap } from '../mailmap/index.js';
import type { MutableAuthorStats } from './types/mutable-author-stats.type.js';

const identityMailmap: Mailmap = {
  canonicalize: (name, email) => ({ name, email }),
};

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
  private readonly mailmap: Mailmap;

  constructor(mailmap: Mailmap = identityMailmap) {
    this.mailmap = mailmap;
  }

  private getOrCreate(rawName: string, rawEmail: string): MutableAuthorStats {
    const { name, email } = this.mailmap.canonicalize(rawName, rawEmail);
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

  build(meta: Report['meta'], repoBase: Report['repo']): Report {
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
      repo: { ...repoBase, totals },
      authors,
      warnings: this.warnings.slice(),
    };
  }

  /** Test-only accessor. */
  getStatsForTesting(): ReadonlyMap<string, MutableAuthorStats> {
    return this.authors;
  }

  /** Test-only accessor. */
  getWarningsForTesting(): readonly Warning[] {
    return this.warnings;
  }
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/internal/identity/aggregator/aggregator.test.ts`
Expected: 14 cases green (11 existing + 3 new).

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/identity/aggregator/aggregator.ts src/internal/identity/aggregator/aggregator.test.ts
git commit -m "Apply Mailmap inside Aggregator getOrCreate"
```

---

## Task 13: Wire mailmap into `analyze()`

**Files:**

- Modify: `src/analyze.ts`
- Modify: `src/analyze.test.ts`

When `options.options.applyMailmap !== false`, `analyze()` loads the repo's `.mailmap` and passes it to the `Aggregator`. When the option is explicitly `false`, the aggregator runs without canonicalisation.

- [ ] **Step 1: Add new failing test**

Open `src/analyze.test.ts` and add this test inside the existing `describe('analyze', ...)` block:

```ts
it('merges identities via .mailmap by default', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@old>',
      date: '2024-01-01T00:00:00Z',
      files: { 'a.txt': 'old\n' },
    },
    {
      author: 'Alice <alice@new>',
      date: '2024-01-02T00:00:00Z',
      files: { 'b.txt': 'new\n' },
    },
  ]);
  createdRepos.push(dir);

  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  writeFileSync(join(dir, '.mailmap'), 'Alice Canonical <alice@new> <alice@old>\n');
  spawnSync('git', ['add', '.mailmap'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'add mailmap'], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2024-01-03T00:00:00Z',
      GIT_COMMITTER_DATE: '2024-01-03T00:00:00Z',
      GIT_AUTHOR_NAME: 'Alice',
      GIT_AUTHOR_EMAIL: 'alice@new',
      GIT_COMMITTER_NAME: 'Alice',
      GIT_COMMITTER_EMAIL: 'alice@new',
    },
  });

  const report = await analyze({ path: dir });

  // Both commits should be merged under the canonical identity
  expect(report.authors).toHaveLength(1);
  expect(report.authors[0]?.email).toBe('alice@new');
  expect(report.authors[0]?.name).toBe('Alice Canonical');
  expect(report.authors[0]?.commits).toBe(3); // 2 content commits + the .mailmap commit (made as alice@new)
});

it('does not apply mailmap when options.applyMailmap is false', async () => {
  const dir = buildRepo([
    {
      author: 'Alice <alice@old>',
      date: '2024-01-01T00:00:00Z',
      files: { 'a.txt': 'old\n' },
    },
    {
      author: 'Alice <alice@new>',
      date: '2024-01-02T00:00:00Z',
      files: { 'b.txt': 'new\n' },
    },
  ]);
  createdRepos.push(dir);

  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  writeFileSync(join(dir, '.mailmap'), 'Alice Canonical <alice@new> <alice@old>\n');
  spawnSync('git', ['add', '.mailmap'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'add mailmap'], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2024-01-03T00:00:00Z',
      GIT_COMMITTER_DATE: '2024-01-03T00:00:00Z',
      GIT_AUTHOR_NAME: 'Alice',
      GIT_AUTHOR_EMAIL: 'alice@new',
      GIT_COMMITTER_NAME: 'Alice',
      GIT_COMMITTER_EMAIL: 'alice@new',
    },
  });

  const report = await analyze({
    path: dir,
    options: { applyMailmap: false },
  });

  // Two distinct identities preserved
  expect(report.authors).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run src/analyze.test.ts`
Expected: existing 5 pass, 2 new tests fail because `analyze()` doesn't load the mailmap yet.

- [ ] **Step 3: Update `analyze.ts`**

Replace the contents of `src/analyze.ts` with this code:

```ts
import { Aggregator } from './internal/identity/aggregator/index.js';
import { loadMailmap } from './internal/identity/mailmap/index.js';
import { assembleReport } from './internal/pipeline/assemble-report.js';
import { discover } from './internal/pipeline/discover.js';
import { runBlamePhase } from './internal/pipeline/run-blame-phase.js';
import { runLogPhase } from './internal/pipeline/run-log-phase.js';
import type { AnalyzeOptions } from './types/analyze-options.type.js';
import type { Report } from './types/report.type.js';

const resolveDefaults = (options: AnalyzeOptions) => ({
  includeGenerated: options.include?.generated ?? false,
  ignoreWhitespace: !(options.include?.whitespace ?? false),
  followRenames: options.options?.followRenames ?? true,
  applyMailmap: options.options?.applyMailmap ?? true,
});

export const analyze = async (options: AnalyzeOptions): Promise<Report> => {
  const startedAt = new Date();
  const startMs = Date.now();
  const resolved = resolveDefaults(options);

  const discovered = await discover(options.path, {
    includeGenerated: resolved.includeGenerated,
  });

  const mailmap = resolved.applyMailmap ? loadMailmap(options.path) : undefined;
  const aggregator = new Aggregator(mailmap);

  for (const warning of discovered.warnings) {
    aggregator.recordWarning(warning);
  }

  await Promise.all([
    runLogPhase(options.path, aggregator),
    runBlamePhase(options.path, discovered.files, aggregator, {
      followRenames: resolved.followRenames,
      ignoreWhitespace: resolved.ignoreWhitespace,
    }),
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

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/analyze.test.ts`
Expected: 7 cases green.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: every test still passes.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/analyze.ts src/analyze.test.ts
git commit -m "Load mailmap by default and pass it to Aggregator"
```

---

## Task 14: Dogfood verification

**Files:** none (verification only)

The moment of truth. Re-run `node-fame` against `/Users/mike/work/store` and confirm the numbers drop into the right ballpark.

- [ ] **Step 1: Build a clean dist**

```bash
rm -rf dist && npm run build
```

Expected: build succeeds. `dist/cli/bin.js` exists.

- [ ] **Step 2: Run the CLI against the store repo**

```bash
node dist/cli/bin.js /Users/mike/work/store
```

Expected behaviour:

- Total `linesAlive` (sum of the column) should be around **130 000–150 000** (down from ~520k before this plan). The exact number depends on whether `git-fame` and `node-fame` count blank lines identically and how each handles a few edge cases — anything in that ballpark is a pass.
- The two `Mykhailo Kalashnikov` identities seen in M3's dogfood should now be merged into ONE row (because the store repo has its own `.mailmap`, OR because both identities share an email pattern that mailmap canonicalisation handles). If they are still separate, that means the store repo has no `.mailmap` — that is fine, document it but do not call M4a a failure.
- The `semantic-release-bot` row should still be present.
- `percentAlive` for the top author should be > 95%.

- [ ] **Step 3: Compare against git-fame**

The reference command from the user's session:

```bash
docker run --rm -v "/Users/mike/work/store:/repo" -u "$(id -u)" casperdcl/git-fame --incl='\.(ts|tsx|css)$' --excl='lock'
```

Reference values from the M3 dogfood: total loc 135 159 across 2 797 files.

Note that `git-fame` was run with a tight filter (`.ts/.tsx/.css` only). `node-fame` does NOT yet have user-controlled glob filters (those land in M4b), so it includes other text file types too (Markdown, JSON configs, YAML, SQL — but NOT lock files or migration snapshots, which the generated filter now strips). Expect `node-fame` to be slightly higher than git-fame's number because it counts more file types.

If the gap is larger than ~25%, investigate:

- Run `node dist/cli/bin.js /Users/mike/work/store 2>&1 | tee /tmp/store-report.txt` and check the warnings line for `FILE_SKIPPED_GENERATED` count
- Use `git ls-files | wc -l` and `git ls-files | grep -E '\.(ts|tsx|css)$' | wc -l` to compare the file universes
- If a specific file type is bloating the count, note it for the `built-in-patterns.ts` list — adding it is a one-line fix in a follow-up commit

- [ ] **Step 4: Run on the node-fame repo too**

```bash
node dist/cli/bin.js .
```

Expected: numbers similar to M3's dogfood, possibly slightly different because of `-w` and `-M -C`. The two `Mykhailo Kalashnikov` identities (main email and GitHub noreply) will only merge if you have a `.mailmap` in `node-fame`'s root. If you do not, they stay separate — this is correct behaviour.

If the two identities are separate and you want them merged, write a `.mailmap` file:

```
Mykhailo Kalashnikov <mihal.kalashnikov@gmail.com> <48096025+devpls@users.noreply.github.com>
```

Add it, commit it, and re-run the CLI. The two rows should collapse into one.

- [ ] **Step 5: Run lint, tests, coverage one last time**

```bash
npm run lint
npm run test:run
npm run coverage
```

Expected: all green; coverage ≥ 90% globally; the new modules at ≥ 95%.

- [ ] **Step 6: Verify commit history**

```bash
git status
git log --oneline feat/initial ^main | head -25
```

Expected: working tree clean; ~13 new commits from this plan layered on top of M3.

- [ ] **Step 7: Paste the dogfood output into the session**

Drop the table from Step 2 (and optionally Step 4) into the session so the user can sanity-check the numbers. If anything looks suspicious, fix it before declaring M4a complete.

---

## Self-review notes

**Spec coverage** (spec §7 M4 — partial, M4a only):

- ✅ `internal/filter/generated.ts` — Tasks 2–5 (folder-pattern, broken into helpers)
- ✅ `internal/identity/mailmap.ts` — Tasks 10–11 (folder-pattern)
- ✅ Default whitespace ignore (`-w` in blame) — Task 8
- ✅ Default rename follow (`-M -C` in blame) — Task 8
- ✅ `AnalyzeOptions` `include` and `options` sub-objects — Task 6
- ✅ Aggregator mailmap integration — Task 12
- ✅ End-to-end wiring — Tasks 9, 13
- ✅ Dogfood verification — Task 14

**Deferred to M4b** (separate plan):

- `internal/filter/minified.ts`
- `internal/filter/glob.ts` (picomatch user-glob wrapper, distinct from built-in patterns)
- `--include-*` / `--no-*` CLI flags (commander wiring)
- `--include-globs` / `--exclude-globs` flags
- Minified filter integration into discover

**Integration test pairs** (per spec §7 M4 deliverable):

- ✅ Generated on/off — Task 9 (`analyze.test.ts`)
- ✅ Mailmap on/off — Task 13 (`analyze.test.ts`)
- ✅ Whitespace on/off — Task 8 (`run-blame-phase.test.ts`)
- ✅ Renames on/off — Task 8 (`run-blame-phase.test.ts`, follows-renames test)

**Known limitations after M4a:**

- The `whitespace` mapping in `resolveDefaults` (`!options.include?.whitespace`) inverts the user-facing flag for the blame argument. This is intentional but counter-intuitive — `include.whitespace: true` means "count whitespace lines as content", which translates to `git blame` WITHOUT `-w`. Document this in CLAUDE.md or the spec follow-up if it becomes a recurring source of confusion.
- M4a does not detect minified files. Anything that is not a binary AND not in the built-in pattern list AND not tagged in `.gitattributes` will pass through. M4b adds the heuristic minified detector.
- The built-in pattern list is short and conservative. Real-world use will reveal more patterns to add — those should land as small follow-up commits, not bigger refactors.
