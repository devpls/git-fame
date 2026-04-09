# node-fame v0.2.0 — libgit2 WASM Blame Design Spec

**Date:** 2026-04-09
**Status:** Approved for implementation planning
**Author:** Mykhailo Kalashnikov (with Claude brainstorming session)

---

## Goal

Eliminate subprocess overhead in the blame phase by compiling libgit2 to
WebAssembly and calling its blame API directly from Node.js. Expected
3-10x speedup on the blame phase (from ~37-42s to ~5-10s on the store
benchmark repo). Ships as an optional `@node-fame/wasm-blame` package;
`node-fame` falls back to the current subprocess approach when the WASM
package is not installed.

## Scope — v0.2.0

1. **libgit2 WASM blame** (this spec) — the performance core
2. **Cross-run cache by commit SHA** — separate spec
3. **DX polish** (`--bytype`, `--columns`, config file) — separate spec

This spec covers item 1 only. Items 2 and 3 get their own
brainstorm → spec → plan cycles after libgit2 WASM ships.

## Architecture

### Monorepo with npm workspaces

```
node-fame/
├── package.json                    # workspace root: "workspaces": ["packages/*"]
├── packages/
│   ├── node-fame/                  # existing package, moved from repo root
│   │   ├── package.json            # name: "node-fame", version: "0.2.0"
│   │   ├── src/
│   │   ├── cli/
│   │   ├── tests/
│   │   └── ...
│   └── wasm-blame/                 # NEW package
│       ├── package.json            # name: "@node-fame/wasm-blame"
│       ├── build/                  # Emscripten build scripts
│       ├── src/                    # TypeScript wrapper
│       ├── lib/                    # compiled libgit2.wasm + glue JS
│       └── tests/
├── vendor/
│   └── libgit2/                    # git submodule: upstream libgit2
└── tooling/
    └── emscripten/                 # Dockerfile for reproducible builds
```

### Data flow

```
node-fame analyze()
  │
  ├─ try: import('@node-fame/wasm-blame')
  │   ├─ success → WASM path:
  │   │   wasm = await loadWasmGit()
  │   │   repo = wasm.repositoryOpen(path)   ← one open for entire run
  │   │   for each file:
  │   │     blame = repo.blameFile(file, opts)
  │   │     for i in 0..blame.hunkCount():
  │   │       hunk = blame.hunkByIndex(i)
  │   │       repeat hunk.linesInHunk times:
  │   │         aggregator.recordBlameLine(hunkData)
  │   │     blame.free()
  │   │   repo.free()
  │   │   wasm.shutdown()
  │   │
  │   └─ error → fallback (warning to stderr)
  │
  └─ fallback: current spawnGit('blame') per file via p-limit
```

Key property: one `repositoryOpen` per analysis run. libgit2 loads the
pack index once; all subsequent `blameFile` calls reuse it. This
eliminates the per-file pack-index reload that dominates subprocess cost.

### Fallback strategy

Graceful fallback. WASM is the default when `@node-fame/wasm-blame` is
installed. On any error during WASM load or execution:

- Emit warning to stderr: `"WASM blame unavailable, falling back to subprocess (slower)"`
- Continue with the existing subprocess blame path
- The fallback is transparent — the Report is identical regardless of backend

Detection at startup:

```ts
const loadWasmBlame = async (): Promise<WasmGit | undefined> => {
  try {
    const { loadWasmGit } = await import('@node-fame/wasm-blame');
    return await loadWasmGit();
  } catch {
    return undefined;
  }
};
```

Called once per `analyze()` invocation. Result cached for the run.

### Package relationship

`node-fame` declares `@node-fame/wasm-blame` as an `optionalDependency`:

```json
{
  "optionalDependencies": {
    "@node-fame/wasm-blame": "^0.2.0"
  }
}
```

`npm install node-fame` attempts to install wasm-blame but does not fail
if it cannot. Users can also install explicitly:
`npm install @node-fame/wasm-blame`.

---

## Emscripten Build

### Source

Upstream libgit2 pinned to a stable release tag (e.g. `v1.8.x`) as a
git submodule in `vendor/libgit2/`.

### CMake configuration

Full libgit2 build without networking:

```cmake
-DBUILD_SHARED_LIBS=OFF
-DBUILD_TESTS=OFF
-DBUILD_CLI=OFF
-DUSE_SSH=OFF
-DUSE_HTTPS=OFF
-DUSE_HTTP_PARSER=OFF
-DREGEX_BACKEND=builtin
-DUSE_BUNDLED_ZLIB=ON
```

### Emscripten flags

```
-s MODULARIZE=1
-s EXPORT_ES6=1
-s ENVIRONMENT=node
-s FORCE_FILESYSTEM=1
-s EXPORTED_FUNCTIONS=[list of C functions]
-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','FS','NODEFS','getValue','UTF8ToString']
-s ALLOW_MEMORY_GROWTH=1
```

### Exported C functions

```
git_libgit2_init
git_libgit2_shutdown
git_repository_open
git_repository_free
git_blame_file
git_blame_get_hunk_count
git_blame_get_hunk_byindex
git_blame_options_init
git_blame_free
git_oid_tostr
git_error_last
```

Plus any struct-field accessor helpers needed for reading
`git_blame_hunk` fields and `git_signature` fields through Emscripten
pointer arithmetic.

### Filesystem access — NODEFS

Emscripten NODEFS mounts the real filesystem into the WASM sandbox:

```ts
wasmModule.FS.mkdir('/repo');
wasmModule.FS.mount(wasmModule.NODEFS, { root: repoPath }, '/repo');
// libgit2 opens '/repo/.git/' — transparently mapped to disk
```

All file reads go through Emscripten → Node.js `fs` module → OS. This
adds a small overhead per read but leverages OS page cache for pack files
after the first read.

### Build artifacts

- `libgit2.wasm` — ~2-3 MB (full build without networking)
- `libgit2.js` — Emscripten glue code, ~50-100 KB

### Build reproducibility

Dockerfile in `tooling/emscripten/` with pinned Emscripten SDK version.
`npm run build:wasm` in `packages/wasm-blame/` runs the Docker build and
copies artifacts to `lib/`.

---

## TypeScript Wrapper API

### Public exports from `@node-fame/wasm-blame`

```ts
export interface WasmBlameHunk {
  linesInHunk: number;
  finalStartLine: number;
  authorName: string;
  authorEmail: string;
  authorTime: number;
  sha: string;
}

export interface WasmBlameOptions {
  followRenames?: boolean;
  ignoreWhitespace?: boolean;
  newestCommit?: string;
}

export interface WasmBlame {
  hunkCount(): number;
  hunkByIndex(i: number): WasmBlameHunk;
  free(): void;
}

export interface WasmRepository {
  blameFile(path: string, options?: WasmBlameOptions): WasmBlame;
  free(): void;
}

export interface WasmGit {
  repositoryOpen(path: string): WasmRepository;
  shutdown(): void;
}

export const loadWasmGit: () => Promise<WasmGit>;
```

### Internal implementation

The wrapper uses Emscripten's `cwrap` / `ccall` to bind each C function:

```ts
const _git_repository_open = cwrap('git_repository_open', 'number', ['number', 'string']);
const _git_blame_file = cwrap('git_blame_file', 'number', ['number', 'number', 'string', 'number']);
// etc.
```

Struct field access via `getValue(ptr + offset, 'type')` or via small C
helper functions compiled into the WASM that extract fields and return
them as primitives.

String conversion via `UTF8ToString(ptr)` for C strings → JS strings.

### Hunk → BlameLine mapping

One libgit2 hunk = N consecutive lines from the same author. The
`node-fame` aggregator works per-line. Mapping in `run-blame-phase.ts`:

```ts
for (let i = 0; i < blame.hunkCount(); i++) {
  const hunk = blame.hunkByIndex(i);
  for (let line = 0; line < hunk.linesInHunk; line++) {
    aggregator.recordBlameLine({
      sha: hunk.sha,
      authorName: hunk.authorName,
      authorMail: hunk.authorEmail,
      authorTime: hunk.authorTime,
      line: '', // content not needed for counting
      isBoundary: false, // libgit2 does not expose boundary flag directly
    });
  }
}
```

Note: `line: ''` because we only count lines, we don't need content.
`isBoundary: false` because libgit2's public API does not expose the
boundary flag on `git_blame_hunk`. This is a minor difference from the
subprocess path — `isBoundary` is not used in any aggregation logic, so
correctness is unaffected.

### Blame options mapping

```ts
WasmBlameOptions         →  git_blame_options
followRenames: true      →  flags |= GIT_BLAME_TRACK_COPIES_SAME_COMMIT_MOVES
                             flags |= GIT_BLAME_TRACK_COPIES_SAME_FILE
ignoreWhitespace: true   →  flags |= GIT_BLAME_IGNORE_WHITESPACE
newestCommit: 'sha'      →  newest_commit = git_oid_from_string(sha)
```

---

## Testing

### Level 1: WASM unit tests (`packages/wasm-blame/tests/`)

Test the JS wrapper in isolation:

- `repositoryOpen` on a buildRepo fixture → returns handle
- `blameFile` on a 3-line file → hunkCount > 0
- `hunkByIndex(0)` → authorName, authorEmail, linesInHunk filled
- `free()` does not crash (double-free protection)
- `repositoryOpen` on non-existent path → throws
- `blameFile` with `followRenames: true` → correct attribution after rename
- `blameFile` with `ignoreWhitespace: true` → whitespace edits attributed to original author

### Level 2: Comparison tests (`packages/node-fame/tests/`)

Run full `analyze()` twice on the same fixture repo:

- Once forcing WASM backend
- Once forcing subprocess fallback
- Assert `wasmReport.authors` deeply equals `subprocessReport.authors`

Three fixture repos:

1. Single author, 3 files (basic sanity)
2. Two authors with rename history (correctness under -M -C)
3. Whitespace-only edits (correctness under -w)

### Level 3: Fallback tests

- WASM package not installed → subprocess works, warning emitted
- WASM module throws on load (mock) → fallback works, no crash
- WASM blameFile throws mid-run → that file gets BLAME_FAILED warning, rest continues

---

## CI Pipeline

```yaml
jobs:
  node-fame:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        node-version: [20, 22]
        os: [ubuntu-latest, macos-latest]
    steps:
      - npm ci --workspace=packages/node-fame
      - npm run lint --workspace=packages/node-fame
      - npm run test:run --workspace=packages/node-fame

  wasm-blame-build:
    runs-on: ubuntu-latest
    steps:
      - Setup Emscripten SDK (Docker or emsdk action)
      - npm run build:wasm --workspace=packages/wasm-blame
      - Upload libgit2.wasm as artifact

  wasm-blame-test:
    needs: [wasm-blame-build]
    runs-on: ubuntu-latest
    steps:
      - Download wasm artifact
      - npm ci
      - npm run test:run --workspace=packages/wasm-blame

  comparison:
    needs: [wasm-blame-build]
    runs-on: ubuntu-latest
    steps:
      - Download wasm artifact
      - npm ci (workspace linking)
      - npm run test:comparison --workspace=packages/node-fame
```

WASM build on Ubuntu only (Emscripten SDK). node-fame tests on all
platforms. Comparison tests after successful WASM build.

---

## Migration path

### Monorepo setup (first PR, before any WASM work)

1. Create `packages/` directory
2. Move all node-fame files into `packages/node-fame/`
3. Create workspace root `package.json`
4. Create empty `packages/wasm-blame/` scaffold
5. Update CI paths
6. Verify: `npm run --workspace=packages/node-fame test:run` → 303 pass

No code changes — only file moves. Git preserves rename history.

### WASM package development (subsequent PRs)

1. Add `vendor/libgit2` submodule
2. Emscripten build pipeline
3. JS/TS wrapper with types
4. WASM unit tests
5. Integration into `run-blame-phase.ts` (WASM path + fallback)
6. Comparison tests
7. Performance benchmarking gate

### npm publish

Two packages published independently:

```bash
npm publish --workspace=packages/node-fame        # node-fame@0.2.0
npm publish --workspace=packages/wasm-blame        # @node-fame/wasm-blame@0.2.0
```

---

## Performance gate

Before v0.2.0 release, benchmark on the store repo (2800 TS/TSX/CSS
files, 500+ commits):

| Backend              | Target wall time | Minimum acceptable |
| -------------------- | ---------------- | ------------------ |
| Subprocess (current) | 37-42s           | baseline           |
| WASM                 | <10s             | <15s               |
| Speedup              | 4-10x            | 3x minimum         |

If WASM does not achieve at least 3x speedup over subprocess, the
integration is not shipped. Debug and optimize first.

---

## Known limitations

- **`isBoundary` not exposed.** libgit2 blame hunk does not have a
  public boundary flag. All WASM blame lines report `isBoundary: false`.
  This field is not used in aggregation, so no correctness impact.
- **NODEFS overhead.** Each file read goes through Emscripten → Node FS
  → OS. This adds latency per I/O operation compared to native libgit2.
  Mitigation: OS page cache warms up after first pack file read.
- **Emscripten memory.** Large repos with huge pack files may stress
  WASM linear memory. `ALLOW_MEMORY_GROWTH=1` handles this but growth
  events are expensive. Monitor in benchmarks.
- **Build toolchain.** Emscripten SDK is required for development builds
  of wasm-blame. Docker image abstracts this. End users only consume the
  pre-built .wasm file from npm — no build tools needed.

---

## Non-goals for this spec

- Cache layer (separate spec)
- `--bytype` / `--bydir` breakdown (separate spec)
- Config file `.node-famerc` (separate spec)
- Worker threads (unlikely needed after WASM — benchmark first)
- Submodule recursion deeper than one level
- Non-git VCS support
