# M0 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe the abandoned webpack/swc scaffold and stand up a modern TypeScript library-first toolchain (tsup, vitest, flat-config ESLint, husky) on an empty project. End state: every script in `package.json` runs green, CI is green on Node 20 and 22, `ROADMAP.md` exists at the repository root.

**Architecture:** Config-only milestone. No production code beyond a placeholder `src/index.ts` that exports a version string and a trivial vitest that confirms the runner works. Every subsequent plan (M1+) builds on the toolchain established here.

**Tech Stack:** TypeScript (strict), tsup (esbuild + tsc for dts), vitest + @vitest/coverage-v8, ESLint 9 flat config + typescript-eslint, prettier, husky + lint-staged, GitHub Actions.

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. Set by user preference in project memory.

**Context for implementer:** The spec for node-fame lives at `docs/superpowers/specs/2026-04-08-node-fame-design.md`. Read **Section 6** (package config) and **Section 7 M0** (bootstrap deliverables) before starting — everything below is derived from those two subsections.

---

## File structure

| Path                                | Action | Purpose                                                       |
| ----------------------------------- | ------ | ------------------------------------------------------------- |
| `src/main.ts`, `src/**`             | Delete | Old scaffold; replaced by fresh `src/index.ts` at the end     |
| `configs/webpack.base.cjs`          | Delete | Old webpack config                                            |
| `webpack.config.cjs`                | Delete | Old webpack config                                            |
| `.swcrc`                            | Delete | Old swc config                                                |
| `package-lock.json`                 | Delete | Regenerated on fresh `npm install`                            |
| `node_modules/`                     | Delete | Regenerated on fresh `npm install`                            |
| `package.json`                      | Rewrite | New scripts, new deps, library exports                       |
| `tsconfig.json`                     | Rewrite | Strict flags, Bundler moduleResolution                       |
| `tsup.config.ts`                    | Create | Library + CLI entry, ESM + CJS + dts                         |
| `vitest.config.ts`                  | Create | Coverage provider, include globs                             |
| `eslint.config.js`                  | Create | Flat config, typescript-eslint strictTypeChecked             |
| `src/index.ts`                      | Create | `export const version = '0.0.0'`                             |
| `tests/unit/index.test.ts`          | Create | First passing vitest, asserts the version export             |
| `.husky/pre-commit`                 | Create | Runs lint-staged                                             |
| `.husky/pre-push`                   | Create | Runs full test suite                                         |
| `.github/workflows/ci.yml`          | Create | Node 20 + 22 matrix, lint/test/build                         |
| `ROADMAP.md`                        | Create | Future-work backlog from the spec                            |
| `LICENSE`, `.editorconfig`, `.gitignore`, `.prettierrc`, `.prettierignore`, `.idea/`, `docs/`, `.claude/` | Keep as-is | Already valid |

---

## Task 1: Remove old scaffold

**Files:**
- Delete: `src/`, `configs/`, `webpack.config.cjs`, `.swcrc`, `package-lock.json`, `node_modules/`

- [ ] **Step 1: Verify current state**

Run: `ls -la /Users/mike/work/node-fame/`
Expected: sees `src/`, `configs/`, `webpack.config.cjs`, `.swcrc`, `package-lock.json`, `node_modules/` among others.

- [ ] **Step 2: Delete old source, configs, and build artefacts**

```bash
rm -rf src configs webpack.config.cjs .swcrc package-lock.json node_modules
```

- [ ] **Step 3: Verify the deletions landed**

Run: `ls -la /Users/mike/work/node-fame/`
Expected: no `src/`, no `configs/`, no `webpack.config.cjs`, no `.swcrc`, no `package-lock.json`, no `node_modules/`. Still sees `package.json`, `tsconfig.json`, `LICENSE`, `.gitignore`, `docs/`, `.prettierrc`, `.editorconfig`, `.claude/`, `.idea/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove old webpack scaffolding"
```

---

## Task 2: Rewrite `package.json` with the final structure

**Files:**
- Rewrite: `package.json`

- [ ] **Step 1: Write the new `package.json`**

Replace the entire file with the following content:

```json
{
  "name": "node-fame",
  "version": "0.1.0",
  "description": "Fast, accurate git contribution stats — lines, commits, files per author.",
  "license": "MIT",
  "author": "Mykhailo Kalashnikov",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "bin": {
    "node-fame": "./dist/cli/bin.cjs"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "lint": "eslint . && tsc --noEmit",
    "lint:fix": "eslint . --fix",
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage",
    "format": "prettier --write .",
    "build": "tsup",
    "dev": "tsup --watch",
    "prepare": "husky",
    "prepublishOnly": "npm run lint && npm run test:run && npm run build"
  },
  "lint-staged": {
    "*.{ts,js,cjs,mjs}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

Note: `bin` points at `dist/cli/bin.cjs` which doesn't exist yet. That's intentional — the CLI is built in a later milestone. `tsup` won't fail if the file isn't there at M0; it just won't produce it.

- [ ] **Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "Rewrite package.json for tsup library-first layout"
```

---

## Task 3: Install dev dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (regenerated by npm)

This installs everything M0 needs. Runtime dependencies (commander, cli-table3, picomatch, p-limit, progress-bar) are deferred to the milestones that first use them.

- [ ] **Step 1: Install TypeScript, tsup, and Node types**

```bash
npm install -D typescript tsup @types/node
```

Expected: `package.json` gains `devDependencies.typescript`, `devDependencies.tsup`, `devDependencies.@types/node` with `^x.y.z` ranges.

- [ ] **Step 2: Install vitest and coverage provider**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: Install ESLint 9 and typescript-eslint**

```bash
npm install -D eslint typescript-eslint
```

Note: we intentionally do **not** install `@eslint/js` — the spec (Section 6) explains why. `typescript-eslint`'s strict configs cover TypeScript-only projects without it.

- [ ] **Step 4: Install prettier, husky, lint-staged**

```bash
npm install -D prettier husky lint-staged
```

- [ ] **Step 5: Verify the installed versions**

Run: `npm ls --depth=0`
Expected: all of the following appear as dev dependencies with concrete version numbers — `typescript`, `tsup`, `@types/node`, `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript-eslint`, `prettier`, `husky`, `lint-staged`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install dev dependencies"
```

---

## Task 4: Write `tsconfig.json`

**Files:**
- Rewrite: `tsconfig.json`

- [ ] **Step 1: Replace the existing file**

```json
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
      "@/*": ["src/*"],
      "@internal/*": ["src/internal/*"]
    }
  },
  "include": ["src", "cli", "tests", "tsup.config.ts", "vitest.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('tsconfig.json','utf8')); console.log('ok')"`
Expected: `ok`. A proper type-check pass happens later in Task 9 once source files exist.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "Add strict tsconfig with Bundler resolution"
```

---

## Task 5: Write `tsup.config.ts`

**Files:**
- Create: `tsup.config.ts`

- [ ] **Step 1: Create the file**

```ts
import { defineConfig } from 'tsup';

export default defineConfig([
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
]);
```

Note: only the library entry is defined at M0. The CLI entry (`cli/bin.ts`) is added in a later milestone when `cli/bin.ts` actually exists. A second `tsup` entry pointing at a non-existent file would fail the build.

- [ ] **Step 2: Commit**

```bash
git add tsup.config.ts
git commit -m "Add tsup build config for library entry"
```

---

## Task 6: Write `vitest.config.ts`

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create the file**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/types.ts'],
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "Add vitest config with v8 coverage"
```

---

## Task 7: Write `eslint.config.js`

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Create the file**

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
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'no-async-promise-executor': 'error',
      'no-duplicate-case': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add eslint.config.js
git commit -m "Add ESLint 9 flat config with typescript-eslint strict"
```

---

## Task 8: Create minimal `src/index.ts` and first vitest (TDD)

**Files:**
- Create: `src/index.ts`
- Test: `tests/unit/index.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `tests/unit/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { version } from '../../src/index';

describe('node-fame package entry', () => {
  it('exports a version string', () => {
    expect(typeof version).toBe('string');
  });

  it('version follows semver format (major.minor.patch)', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/index.test.ts`
Expected: FAIL. The error is about `../../src/index` not resolving — the file doesn't exist yet.

- [ ] **Step 3: Create the minimal implementation**

Create `src/index.ts`:

```ts
export const version = '0.1.0';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/index.test.ts`
Expected: PASS. Both test cases green.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/unit/index.test.ts
git commit -m "Add version export and smoke test"
```

---

## Task 9: Verify lint is green

**Files:** none

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: exits 0. Both `eslint .` and `tsc --noEmit` pass with no output.

If this fails: the most likely cause is a tsconfig `include` path not matching a file that actually exists. Confirm `tsconfig.json` `include` lists `src`, `tests`, `tsup.config.ts`, `vitest.config.ts` and that each exists.

- [ ] **Step 2: No commit needed — this is a verify-only step**

---

## Task 10: Verify build is green

**Files:** generates `dist/` (gitignored)

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: exits 0. Creates `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts`, plus sourcemaps.

- [ ] **Step 2: Verify dist artefacts exist**

Run: `ls dist/`
Expected output contains: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`, `index.js.map`, `index.cjs.map`.

- [ ] **Step 3: Verify the built module imports correctly**

Run: `node -e "import('./dist/index.js').then(m => console.log(m.version))"`
Expected: `0.1.0`

- [ ] **Step 4: No commit needed — `dist/` is gitignored, this is a verify-only step**

---

## Task 11: Create husky hooks

**Files:**
- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`

**Context:** `"prepare": "husky"` was added to `package.json` in Task 2, so `npm install` in Task 3 already ran `husky` as a post-install step. That means the `.husky/_` shim directory exists and git's `core.hooksPath` is set to it. We just need to create the actual hook files.

- [ ] **Step 1: Verify the husky shim is in place**

Run: `git config --get core.hooksPath`
Expected: `.husky/_`

If the output is empty or different, run `npx husky` once manually and re-check.

- [ ] **Step 2: Create `.husky/pre-commit`**

```bash
mkdir -p .husky
```

Then create `.husky/pre-commit` with the content:

```sh
npx lint-staged
```

- [ ] **Step 3: Create `.husky/pre-push`**

Create `.husky/pre-push` with the content:

```sh
npm run test:run
```

- [ ] **Step 4: Verify both files exist**

Run: `ls -l .husky/pre-commit .husky/pre-push`
Expected: both files present. Husky manages execution through its shim, so explicit `chmod +x` is not required.

- [ ] **Step 5: Commit**

```bash
git add .husky
git commit -m "Add husky pre-commit and pre-push hooks"
```

The commit itself will exercise the `pre-commit` hook (`lint-staged` runs on the staged `.husky/*` files, which do not match any lint-staged glob and are passed through unchanged). This implicitly smoke-tests the wiring.

---

## Task 12: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main, feat/initial]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test:run

      - name: Build
        run: npm run build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI for Node 20 and 22"
```

Note: CI will fail the first time it runs until `main` branch merge, because the workflow references `feat/initial` as a trigger branch. This is intentional — we want CI to run on the current working branch.

---

## Task 13: Create `ROADMAP.md` at the repository root

**Files:**
- Create: `ROADMAP.md`

This is the canonical post-v0.1 backlog. The spec references it from multiple places. Content comes from Section 7 of the spec.

- [ ] **Step 1: Create the file**

```markdown
# node-fame Roadmap

This file tracks work that is explicitly **out of scope** for v0.1.0 and is
planned for later releases. The authoritative context for each item lives in
the design spec at `docs/superpowers/specs/2026-04-08-node-fame-design.md`.

## Post-v0.1.0 backlog

- **Worker threads for blame parsing.** Move porcelain parsing to a
  `worker_threads` pool. Triggered if profiling shows the single-threaded
  parser is the bottleneck on repos in the 50k+ file range.
- **Cross-run result cache by commit SHA.** Cache computed reports keyed by
  the resolved upper-bound SHA so repeated runs on the same commit return
  instantly.
- **Incremental analysis.** Compute only the diff since the previous cached
  run (requires the result cache to land first).
- **Per-language / per-directory breakdowns** (`--bytype`, `--bydir` à la
  git-fame). Requires a language detector and a second aggregation axis.
- **HTML / SVG reports.** A richer renderer, likely generated from JSON
  output with a template.
- **Public `AsyncIterable<ProgressEvent>` API.** Currently progress is
  callback-only; an iterable variant would be idiomatic for programmatic
  consumers.
- **`--fail-on-warning` CLI flag.** Exit non-zero if any `Warning` was
  collected during analysis.
- **Submodule recursion deeper than one level.** Today `--submodules` walks
  one level down; nested submodules of submodules are ignored.
- **Non-git VCS support.** Mercurial, Fossil, etc. Would require a pluggable
  backend layer.
- **Config file** (e.g. `.node-famerc`). Lets users pin flags per repository
  without wrapper scripts.

## How to use this file

When planning a new release, open this file first. Pick items that match the
release theme. Move picked items into a milestone plan under
`docs/superpowers/plans/`. Remove them from here once shipped.
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "Add ROADMAP.md with post-v0.1 backlog"
```

---

## Task 14: Final comprehensive verification

**Files:** none (verification only)

Runs every script in `package.json` to confirm the whole toolchain is green end-to-end. This is the M0 gate.

- [ ] **Step 1: Clean install from scratch**

```bash
rm -rf node_modules dist coverage
npm ci
```

Expected: `npm ci` completes without errors. `node_modules/` is restored.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

Expected: all tests pass (at least the two smoke tests from Task 8).

- [ ] **Step 4: Run coverage**

```bash
npm run coverage
```

Expected: exits 0, prints a coverage table. At M0 coverage is a formality — only `src/index.ts` is covered.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: exits 0, `dist/` populated.

- [ ] **Step 6: Verify everything is committed**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 7: Verify the commit history is sensible**

```bash
git log --oneline feat/initial ^main
```

Expected: a linear sequence of the 13 commits created by this plan, one per task that has a commit step (Tasks 1–7, 8, 11, 12, 13 — Tasks 9, 10, 14 are verify-only and do not produce commits).
