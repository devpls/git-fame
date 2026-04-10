# .node-famerc Config File — Design Spec

**Date:** 2026-04-09
**Status:** Approved for implementation

---

## Goal

Allow users to pin CLI flags per repository via a `.node-famerc` JSON file
in the repo root, so repeated runs don't need long flag lists.

## File format

- **Name:** `.node-famerc`
- **Location:** repository root (same directory as `.git/`)
- **Format:** JSON
- **Required:** no — if absent, behavior is unchanged

## Supported fields

All CLI flags except `path`, `--version`, `--help`. All fields optional.

```json
{
  "format": "table",
  "sort": "linesAlive",
  "limit": 10,
  "rev": "main",
  "from": "v1.0.0",
  "to": "v2.0.0",
  "since": "2024-01-01",
  "until": "2024-12-31",
  "includeGlobs": ["**/*.ts", "**/*.tsx"],
  "excludeGlobs": ["**/*.test.ts"],
  "includeWhitespace": false,
  "includeBinary": false,
  "includeGenerated": false,
  "excludeMinified": false,
  "followRenames": true,
  "mailmap": true,
  "cache": true,
  "concurrency": 12,
  "submodules": false,
  "splitSubmodules": false,
  "recursive": false
}
```

Empty `{}` is valid.

## Precedence

CLI flags > `.node-famerc` > built-in defaults.

If a user passes `--format json` on the CLI and `.node-famerc` has
`"format": "table"`, the CLI flag wins.

## Loading

- Read from `join(path, '.node-famerc')` where `path` is the analysis
  target (first positional argument, default `process.cwd()`).
- `JSON.parse(readFileSync(..., 'utf8'))`.
- If file doesn't exist: skip silently.
- If JSON is malformed: throw with clear message:
  `"Failed to parse .node-famerc: <JSON parse error message>"`.
- If a field has an unexpected type (e.g. `"limit": "ten"`): ignore the
  field (use default). No error — lenient on types, strict on JSON syntax.

## Where it hooks in

In `cli/parse-flags.ts`, after Commander parses argv and before building
`AnalyzeOptions`. The merge logic:

```
for each config field:
  if CLI explicitly set this flag → use CLI value
  else if .node-famerc has this field → use config value
  else → use default
```

Commander's `.opts()` returns `undefined` for unset options and explicit
values for set ones. This makes it straightforward to detect "was this flag
passed on CLI?" vs "using default".

## Scope

- **CLI only.** The library API (`analyze()`, `analyzeMany()`) does not
  read `.node-famerc`. Library consumers pass explicit options.
- **No config inheritance.** No walking up directories, no global config,
  no `extends` field. One file, one repo.
- **No validation schema.** Unknown fields are silently ignored (forward
  compatibility — future versions may add fields).

## File structure

New files:

- `src/internal/config/load-config.ts` — reads and parses `.node-famerc`
- `src/internal/config/load-config.test.ts` — tests

Modified files:

- `cli/parse-flags.ts` — merge config with CLI flags

## Testing

- File exists with valid JSON → returns parsed config
- File doesn't exist → returns empty config (all undefined)
- Malformed JSON → throws with message containing "Failed to parse"
- Unknown fields → silently ignored
- Integration: CLI with `.node-famerc` applies config values
- Integration: CLI flag overrides `.node-famerc` value
