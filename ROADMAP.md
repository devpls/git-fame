# node-fame Roadmap

This file tracks work that is explicitly **out of scope** for v0.1.0 and is
planned for later releases. The authoritative context for each item lives in
the design spec at `docs/superpowers/specs/2026-04-08-node-fame-design.md`.

## Post-v0.1.0 backlog

- **libgit2-wasm blame (v0.2.0 priority).** Compile libgit2's blame API to
  WebAssembly via Emscripten. Eliminates the ~2800 subprocess spawns that
  dominate execution time. Cross-platform (no native build), ships as a
  `.wasm` file in the npm package. Expected 5-10x speedup over the current
  subprocess approach. Profiling shows 76% of wall-clock time is in git
  blame subprocesses; the remaining 24% is Node overhead.
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
- **Dual ESM+CJS publishing.** v0.1.0 ships ESM-only because TypeScript 6's
  deprecation of `moduleResolution=node10` makes CJS emission noisy without
  workarounds. When the ecosystem catches up (tsc 7 drops the deprecated
  option entirely, or zshy ships a supported path), re-evaluate adding CJS
  output back.

## How to use this file

When planning a new release, open this file first. Pick items that match the
release theme. Move picked items into a milestone plan under
`docs/superpowers/plans/`. Remove them from here once shipped.
