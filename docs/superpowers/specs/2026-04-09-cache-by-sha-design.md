# Cache by SHA — Design Spec

**Date:** 2026-04-09
**Status:** Approved for implementation

---

## Goal

Cache computed `Report` objects keyed by an analysis fingerprint so that
repeated runs on the same commit with the same options return instantly.
Repo-local, clean-worktree-only, atomic writes.

## Storage

Cache directory: `$(git rev-parse --git-dir)/node-fame-cache/`.

- Inside the git directory — no `.gitignore` needed, doesn't clutter repo root.
- Deleted automatically when the repo is deleted.
- One JSON file per cached analysis: `<fingerprint>.json`.

## Cache key (analysis fingerprint)

SHA-256 hash of the following canonicalized inputs, concatenated with `\n`
separators:

1. `cacheFormatVersion` — a constant string bumped when the Report schema,
   aggregation algorithm, or built-in generated patterns change. Start at `"1"`.
2. Resolved commit SHA — single string for `--rev`, or `fromSha..toSha` for
   range mode.
3. `since` — ISO 8601 string, or empty string if not set.
4. `until` — ISO 8601 string, or empty string if not set.
5. `followRenames` — `"true"` or `"false"`.
6. `ignoreWhitespace` — `"true"` or `"false"`.
7. `applyMailmap` — `"true"` or `"false"`.
8. `includeGenerated` — `"true"` or `"false"`.
9. `includeBinary` — `"true"` or `"false"`.
10. `includeMinified` — `"true"` or `"false"`.
11. `includeGlobs` — sorted, joined with `\0`, or empty string.
12. `excludeGlobs` — sorted, joined with `\0`, or empty string.
13. `.mailmap` file content — raw UTF-8, or empty string if absent.
14. `.gitattributes` file content — raw UTF-8, or empty string if absent.

The fingerprint is deterministic: same inputs always produce the same hash.
Sorting globs ensures order-independence.

## Dirty worktree check

Before reading or writing cache, check worktree cleanliness:

```
git status --porcelain --untracked-files=no
```

If output is non-empty (tracked files modified), bypass cache entirely —
don't read, don't write. Untracked files are ignored (`.mailmap` and
`.gitattributes` are already hashed separately).

## Cache hit flow

```
analyze(options)
  if --no-cache → skip cache
  if dirty worktree → skip cache
  fingerprint = computeFingerprint(resolvedOptions)
  cachePath = <git-dir>/node-fame-cache/<fingerprint>.json
  if file exists:
    report = JSON.parse(file)
    rehydrate Date fields:
      meta.generatedAt = new Date(meta.generatedAt)
      authors[].firstCommit = new Date(authors[].firstCommit)
      authors[].lastCommit = new Date(authors[].lastCommit)
    meta.durationMs = time spent reading cache
    meta.cached = true
    return report
  else:
    run full analysis
    meta.cached = false
    write report JSON atomically (tmp file → rename)
    return report
```

## Cache write — atomic

Write to a temporary file in the same directory, then rename:

```ts
const tmpPath = cachePath + '.tmp.' + randomUUID();
writeFileSync(tmpPath, json, 'utf8');
renameSync(tmpPath, cachePath);
```

This ensures parallel runs don't produce corrupt JSON.

## Report type changes

Add `cached` to `meta`:

```ts
meta: {
  version: string;
  generatedAt: Date;
  durationMs: number;
  cached: boolean; // NEW
}
```

This is a public type change — `Report` is exported from `src/index.ts`.
Default: `false` for fresh analysis, `true` for cache hit.

## AnalyzeOptions change

Add `cache` option:

```ts
cache?: boolean;  // default: true
```

CLI flag: `--no-cache` (commander's `--no-` convention, same as
`--no-follow-renames`).

## What is NOT cached

- `analyzeMany()` does not cache at its level. Each inner `analyze()` call
  checks its own cache independently.
- Submodule analysis in `analyze()` with `submodules: true` — each recursive
  `analyze()` call checks its own repo's cache.

## Cache format version

Constant `CACHE_FORMAT_VERSION = '1'` in the cache module. Bump when:

- `Report` type changes (new fields, removed fields, type changes)
- Aggregation algorithm changes (different counting logic)
- Built-in generated patterns change (different file filtering)

Old cache entries with stale format versions are simply never hit (different
fingerprint). No explicit cleanup needed — they're orphaned JSON files.

## File structure

New files:

- `src/internal/cache/compute-fingerprint.ts` — builds the fingerprint
- `src/internal/cache/read-cache.ts` — reads + rehydrates cached report
- `src/internal/cache/write-cache.ts` — atomic write
- `src/internal/cache/is-worktree-clean.ts` — dirty check
- `src/internal/cache/index.ts` — barrel
- Tests colocated per file

Modified files:

- `src/types/report.type.ts` — add `cached: boolean` to meta
- `src/types/analyze-options.type.ts` — add `cache?: boolean`
- `src/analyze.ts` — wire cache read/write around analysis
- `src/internal/pipeline/assemble-report.ts` — set `cached: false`
- `cli/parse-flags.ts` — add `--no-cache` flag
- `src/render/json/render-json.ts` — serialize Date fields (already works)

## Testing

- `compute-fingerprint.test.ts` — deterministic, order-independent globs,
  different options → different fingerprints
- `read-cache.test.ts` — reads valid JSON, rehydrates Dates, returns
  undefined for missing file
- `write-cache.test.ts` — writes atomically (no `.tmp` files left behind)
- `is-worktree-clean.test.ts` — clean repo → true, modified tracked file →
  false, untracked file → true
- Integration: `analyze()` with cache — second call returns `cached: true`
  with identical `authors`

## Non-goals

- Cache eviction / size limits (orphaned entries are small, ~10KB each)
- Cache sharing between machines
- Partial / incremental cache (diff from previous SHA)
- Caching across different repo clones
