# CLAUDE.md

Project conventions, commands, and architectural rules for `node-fame`. This
file is loaded into context for every Claude Code session in this repository.
If you change a rule here, update it everywhere it conflicts in the code.

## What this is

`node-fame` is an npm package (library + CLI) that analyses a git repository
and builds a per-author contribution report. It reports both "lines alive in
HEAD" (from `git blame`) and "lines added / deleted" (from `git log
--numstat`). Inspired by `git-fame` (Python), rewritten for correctness and
speed.

**Canonical design spec:** `docs/superpowers/specs/2026-04-08-node-fame-design.md`.
Read this before making architectural decisions. Implementation plans live
under `docs/superpowers/plans/`.

**Post-v0.1 backlog:** `ROADMAP.md` at the repo root.

## Stack

- **Node.js ≥ 20.** ESM-only package (`"type": "module"`).
- **TypeScript 6** with strict mode + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`.
- **zshy** for builds — bundler-free, powered by `tsc`. Replaces tsup, which
  broke on several TS 6 interactions.
- **vitest 4** for testing, `@vitest/coverage-v8` for coverage.
- **ESLint 9 flat config** + `typescript-eslint` `strictTypeChecked` +
  `stylisticTypeChecked`. Config is a `.ts` file loaded via **`jiti`** (required
  dev dep — ESLint 9+ uses it to load TypeScript configs).
- **prettier** for formatting.
- **husky 9** + **lint-staged 16** for git hooks.

## Commands

```bash
npm run lint        # eslint . && tsc --noEmit — both must pass
npm run lint:fix    # eslint . --fix
npm run test        # vitest watch mode
npm run test:run    # vitest run once
npm run coverage    # vitest run --coverage (v8 provider)
npm run build       # zshy — produces dist/ ESM output
npm run dev         # zshy --watch
npm run format      # prettier --write .
```

`npm run lint` is the gate during development. `npm run build` runs in CI and
in `prepublishOnly`. Coverage target is ≥ 90% lines overall, 100% on pure
unit modules (errors, parsers, filters, identity, render).

### Running a subset of tests (TDD flow)

```bash
npx vitest run path/to/file.test.ts          # one file
npx vitest run src/errors/                    # one directory
npx vitest -t "carries message and code"      # by test name (supports watch + run)
```

Use `npx vitest run` (not `npx vitest`) unless you want watch mode.

## Pre-commit hooks

- **`.husky/pre-commit`** runs `npx lint-staged`, which runs `eslint --fix`
  and `prettier --write` on staged files. Normal commits should just work.
- **`.husky/pre-push`** runs `npm run test:run`.
- Do NOT use `--no-verify` unless explicitly asked. Fix the underlying issue.

## Commit style (STRICT)

- **Single-line messages.** No body, no blank line, no trailing description.
- **Plain English.** Describe what changed in ≤ 72 characters where possible.
- **NO semantic prefixes.** Not `feat:`, `fix:`, `docs:`, `chore:`, etc.
- **NO `Co-Authored-By` trailers.** Not for Claude, not for anyone.
- Pass messages with `git commit -m "..."`, not a HEREDOC.

Examples:

```
Add typed error classes for git and analysis failures
Wrap spawnGit non-zero exits in GitCommandError
Replace tsup with zshy and go ESM-only for TS 6 compatibility
```

## Code style

### Context → class, no-context → arrow

The keyword carries architectural meaning.

- **`class`** — use when the code has encapsulated state (`this`), multiple
  methods operating on shared data, or needs `instanceof` identity. Examples:
  `NodeFameError` and subclasses (instanceof in catch blocks), the future
  `Aggregator` (mutable Map across pipeline phases).
- **`const foo = (args): Ret => { ... }`** — arrow function, the default for
  every stateless operation. The absence of `this` in arrows is the feature
  that expresses "this code is stateless, do not couple it to any context".
- **`function` keyword** — only for generators: `function*` and `async
function*`. Arrow generators do not exist in JavaScript. Parsers like
  `parseBlamePorcelain` and `parseLogNumstat` will use `async function*`.
  Nothing else uses the `function` keyword.

### No hoisting

Define helpers before the functions that use them. Files read top-down from
dependencies up to main exports. Do not rely on function declaration
hoisting.

### Class methods

Use regular method syntax on the prototype, not arrow fields. Arrow fields
allocate a new function per instance, break subclass overrides, and are
usually a sign that the interface is passing methods as callbacks when it
shouldn't.

```ts
// ✅
class Aggregator {
  blameLine(name: string, email: string, line: string): void { ... }
}

// ❌ per-instance allocation, broken super, usually a smell
class Aggregator {
  blameLine = (name: string, email: string, line: string): void => { ... };
}
```

### Named exports only — no default exports

Every export is named. Default exports break tree-shaking, decouple the
file name from the symbol name (any consumer can rename the default),
and are worse for IDE auto-import.

```ts
// ✅
export const spawnGit = (args, cwd) => { ... };

// ❌
export default (args, cwd) => { ... };
```

### `undefined` over `null`

Use `undefined` for absence. Reach for `null` only at the boundary with
external APIs that return it (DOM, JSON.parse with explicit `null` values,
database drivers). The `exactOptionalPropertyTypes` tsconfig flag already
prevents most footguns; this rule keeps the codebase uniform.

```ts
// ✅
type Options = { signal?: AbortSignal }; // signal is undefined when absent

// ❌
type Options = { signal: AbortSignal | null };
```

### Explicit return types on exported functions

Every exported function or method declares its return type explicitly.
Implicit return types on a public API are a footgun — a refactor inside
the function silently changes the public contract, and no diff shows up at
the call sites.

```ts
// ✅
export const resolveRev = async (cwd: string, rev: string): Promise<string> => { ... };

// ❌ return type drifts with implementation
export const resolveRev = async (cwd: string, rev: string) => { ... };
```

Private module helpers may omit return types where inference is trivial
and local.

## File structure

### One public export per file

Every source file exports exactly **one** function or class. Colocate types
used in that one function's signature in the same file. Do not bundle
"related" public functions into one file — related functions share a folder
with a barrel, not a file.

### Angular-style naming

- **kebab-case** for all file and folder names.
- **Dot-separated role suffix** for role-bearing files:
  - `.error.ts` — error classes.
  - `.test.ts` — test files.
  - `.type.ts` — type-only modules (none in M1).
- Domain functions have no suffix: `spawn-git.ts`, `is-git-repo.ts`,
  `resolve-rev.ts`.
- Do NOT use `.service.ts` — the Angular ecosystem reserves it for
  `@Injectable` services, and using it for plain functions misleads.
- **File name matches the exported symbol** in kebab-case. `NotAGitRepoError`
  → `not-a-git-repo.error.ts`. `spawnGit` → `spawn-git.ts`.

### Private helpers

- **One consumer:** colocate in the caller's file.
- **Two or more consumers:** extract to a dedicated file (e.g.
  `src/internal/git/collect-stream.ts` as a shared stream collector used by
  `resolve-rev.ts`, `list-tracked-files.ts`, `assert-git-installed.ts`).

### Folder-pattern for complex operations

When a single public function or class has several internal artifacts —
multiple private helpers, multiple private types beyond the main signature,
large constant tables, a multi-stage state machine — upgrade from a single
file to a folder:

```
some-operation/
├── index.ts              # barrel: re-export from some-operation.ts
├── some-operation.ts     # the main function or class
├── helpers/              # private, single-use helpers
│   ├── parse-header.ts
│   └── ...
├── types/                # private types beyond the main signature
│   └── internal-state.ts
└── utils/                # small utilities used only by this operation
    └── format.ts
```

Trigger: "several helpers / utils / types / etc". A single return type and a
couple of constants do NOT trigger folder-pattern — stay with a single file.

M1 has no folder-pattern candidates — everything is simple enough for single
files. M2 parsers (`parseBlamePorcelain`, `parseLogNumstat`) and the future
`Aggregator` class will likely use folder-pattern.

### Barrels

- **`src/index.ts`** — public package entry. Re-exports the error classes
  and (later) `analyze`, `analyzeMany`, `render`, public types.
- **`src/errors/index.ts`** — barrel for the seven error classes.
- **`src/internal/git/index.ts`** — internal barrel (allowed here as a
  convenience for pipeline code that needs several git helpers together).
- Barrels contain only `export { ... } from '...'` statements, no logic.
- Barrels are required for public API directories, not optional.

### Test file layout — colocated

Test files live **immediately next to the source file they test**. A file
named `spawn-git.ts` has its test at `spawn-git.test.ts` in the same
directory. This makes rename/delete/grep trivially safe and eliminates the
"where is the test for this?" question.

```
src/errors/
├── not-a-git-repo.error.ts
├── not-a-git-repo.error.test.ts       ← right next to it
├── git-command.error.ts
└── git-command.error.test.ts
```

The unit-vs-integration distinction is semantic (does it spawn git? does it
touch tmpdir?), not positional. A `spawn-git.test.ts` living next to
`spawn-git.ts` can still be an integration test — that's fine.

`tests/` at the repo root holds only **test-only code with no source
counterpart**: shared test helpers, fixtures, future E2E tests. For example,
`tests/helpers/build-repo.ts` is a fixture factory that does not correspond
to any file in `src/`.

```
tests/
└── helpers/
    ├── build-repo.ts
    ├── build-repo.test.ts       ← colocated even inside tests/
    ├── cleanup-repo.ts
    └── cleanup-repo.test.ts
```

Test helpers that have their own tests (meta-tests) follow the same
colocation rule within `tests/helpers/`.

## Testing conventions

- **Deterministic time.** Use explicit `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`
  in fixture commits. Never call `new Date()` / `Date.now()` / `Math.random()`
  without a seed in tests.
- **Per-test fixture lifecycle.** Each test creates its own tmp directories,
  tracks them in a local `created[]` array, and cleans them up in `afterEach`.
  Tests never share state.
- **UUID-named tmpdirs** via `randomUUID()` so vitest can run tests in
  parallel without collisions.
- **One test = one fixture.** Never reuse a fixture repo across tests. Small
  duplication is better than cross-test coupling.
- **Structure:** `describe('<unit name>', () => { it('<behaviour>', () => {}); });`.
  One `describe` per file. Test names describe behaviour in natural language,
  not implementation.
- **Assert behaviour, not implementation.** Tests assert observable outputs
  (return values, thrown errors, `report.warnings` entries), not internal
  state.

## ESM import conventions

- **Source code uses explicit `.js` extensions** on relative imports:
  `import { spawnGit } from './spawn-git.js'`. Node ESM resolution requires
  them at runtime, and TypeScript with `moduleResolution: "Bundler"` accepts
  them.
- **Test files may omit extensions** because vitest resolves via vite, but
  for consistency we use `.js` everywhere.
- **`import type { ... }` for type-only imports** — enforced by
  `@typescript-eslint/consistent-type-imports`.

## Known ESLint traps

`typescript-eslint`'s `strictTypeChecked` set fires on several patterns that
look idiomatic but need adjustment. Familiar ones:

- **`@typescript-eslint/restrict-template-expressions`** — numbers in
  template literals must be wrapped: `` `exited ${String(code)}` ``.
- **`@typescript-eslint/consistent-type-definitions`** — prefers `interface`
  over `type` for object shapes. Accept; use `interface` for named object
  shapes.
- **`@typescript-eslint/no-unnecessary-boolean-literal-compare`** — write
  `!child.killed` not `child.killed !== true`.
- **`@typescript-eslint/no-floating-promises`** — every promise must be
  awaited or `.catch()`-handled.
- **`@typescript-eslint/no-unnecessary-type-assertion`** — do not cast values
  that are already correctly typed.

Do **not** add `func-style` or similar style-enforcement rules. Style lives
in this file; automated enforcement tends to fire on false positives.

## Known quirks and gotchas

Things that are not obvious and will waste your time if you don't know
about them. Update this list whenever you debug something counter-intuitive.

### zshy rewrites `main`/`module`/`types`/`exports` on every build

`package.json#zshy` is the zshy config. On each build, zshy writes
`main`/`module`/`types`/`exports` into `package.json` to match the produced
dist layout. **Side effect:** if you leave `main` absent in source, zshy fills
it with `./dist/index.cjs` — pointing at a file that doesn't exist in an
ESM-only build. **Workaround:** keep an explicit `main: "./dist/index.js"` in
`package.json` so zshy respects it instead of generating a bad value.

### Path aliases do not work at runtime with zshy

`paths` in `tsconfig.json` is **not** deprecated (it is still fully
supported in TypeScript 6 — only `baseUrl` was deprecated). However, our
build is bundler-free — zshy uses `tsc`, which does **not** rewrite `@/*`-
style aliases in the emitted `.js` files. A source import of
`@/errors/index.js` would land in `dist/` unchanged and fail at Node's
import resolution. **For this project, we use relative imports only.** If
we ever adopt a bundler that rewrites aliases, revisit the decision.

Related note: if you do add `paths` back, use explicit `./` prefixes on
values (`["./src/*"]`, not `["src/*"]`). Without `./`, tsc infers a
`baseUrl` and emits the (deprecated) `baseUrl` warning even when none is
set explicitly.

### ESM-only in v0.1

CJS output is deferred. TypeScript 6 deprecated `moduleResolution=node10`,
which every CJS emission path uses. Re-evaluate when tsc 7 ships or zshy
offers a supported path. See the `ROADMAP.md` entry "Dual ESM+CJS
publishing".

### No `bin` field in `package.json` yet

The CLI is built in M3. Adding `bin` earlier would point at a non-existent
`dist/cli/bin.cjs`.

### Security reminder hook blocks some writes on first match

The Claude Code environment has a security hook that matches certain
strings in file content (e.g. process-spawning APIs, `eval(`, `innerHTML`,
`.github/workflows/*.yml`). On the **first** match per session + file +
rule, the hook blocks the `Write`/`Edit` and prints a security note. State
is cached — the **second** attempt at the same write proceeds. This is
per-file, per-rule, per-session. Not a bypass; just how the hook is
designed. If you hit a block and the content is legitimate (e.g. a plan
document discussing a safe wrapper around a process-spawn API), retry the
same write and it will go through.

Regex `.exec(...)` calls in JavaScript source trigger the process-spawning
pattern via substring match. False positive but expected.

### pre-commit hook reformats staged files

`lint-staged` runs `prettier --write` and `eslint --fix` on staged files
and re-stages the result. Expect small formatting changes to land in your
commit that you did not author explicitly. Normal; don't fight it.

## Dependencies philosophy

- **Minimal runtime deps.** Prefer `node:` built-ins over npm packages.
  Every proposed runtime dependency must justify its weight.
- **Dev deps are cheap.** Add what helps the author loop (formatting,
  testing, type checking, linting) without hesitation.
- **No `@types/*` for packages that ship their own types.** If the package
  already has `.d.ts`, `@types/*` is redundant and sometimes conflicting.
- **Upgrade aggressively but intentionally.** Track major releases; run CI
  on upgrade PRs; revert if something breaks.

## What to do when something's unclear

1. Read the spec section most related to the change.
2. If still unclear, stop and ask — do not guess architectural decisions.
3. Do not add features, JSDoc, options, or abstractions beyond what the
   task specifies. YAGNI is a hard rule.
4. When in doubt about whether a rule applies, re-read this file.
