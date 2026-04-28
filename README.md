# git-fame

Fast, accurate git contribution stats — lines, commits, files per author.

Inspired by [git-fame](https://github.com/casperdcl/git-fame) (Python), rewritten in TypeScript. **47x faster** on real-world repos.

## Quick start

```bash
npx git-fame .
npx git-fame /path/to/repo
npx git-fame --format json .
npx git-fame --bytype .
npx git-fame --recursive --summary ~/work
npx git-fame -o report.json .
```

## Installation

```bash
npm install -g git-fame    # global CLI
npm install git-fame       # library dependency
```

## Features

- **Two metrics**: lines alive in HEAD (blame) + lines added/deleted (log)
- **Smart defaults**: excludes generated files, ignores whitespace, follows renames
- **Fast**: parallel blame workers, ~11s on 2800-file repo (Python git-fame: ~530s)
- **Breakdown**: `--bytype` groups by file extension, `--bydir 1` by directory
- **Caching**: results cached by commit SHA, instant on repeat runs
- **Config file**: `.gitfamerc` pins flags per repo
- **Multi-repo**: `--recursive` scans all repos in a directory
- **Output formats**: table, JSON, CSV, Markdown
- **File output**: `--output report.json` or `--output dir/` for per-repo files
- **Summary**: `--summary` aggregates stats across repos in recursive mode
- **Library + CLI**: use as `npx git-fame` or `import { analyze } from 'git-fame'`

## CLI

```
Usage: git-fame [options] [path]

Options:
  -v, --version                  Output the version number
  --format <format>              Output format: table, json, csv, markdown (default: table)
  --sort <column>                Sort by: linesAlive, linesAdded, linesDeleted, commits, files
  --limit <n>                    Show only top N authors
  --rev <ref>                    Analyze at a specific commit, tag, or branch
  --from <ref>                   Start of commit range (used with --to)
  --to <ref>                     End of commit range (used with --from)
  --since <date>                 Only count log entries after this date
  --until <date>                 Only count log entries before this date
  --include-whitespace           Count whitespace-only changes
  --include-binary               Include binary files
  --include-generated            Include generated/vendored files
  --exclude-minified             Exclude minified files
  --no-follow-renames            Do not follow renames in blame
  --no-mailmap                   Do not apply .mailmap
  --include-globs <a,b,c>        Only analyze matching files (comma-separated)
  --exclude-globs <a,b,c>        Exclude matching files (comma-separated)
  --concurrency <n>              Parallel blame workers (default: auto)
  --no-cache                     Disable result caching
  --bytype                       Group results by file extension
  --bydir <depth>                Group results by directory at given depth
  --per-author                   Show breakdown per author (with --bytype or --bydir)
  --submodules                   Walk into submodules
  --split-submodules             Separate reports per submodule
  --recursive                    Analyze all repos in subdirectories
  -o, --output <path>            Save output to file or directory
  -S, --summary                  Aggregate summary across repos (with --recursive)
  -h, --help                     Display help
```

## Examples

**Default output:**

```bash
$ git-fame .
┌───────┬────────────┬────────────┬──────────────┬─────────┬───────┐
│ author│ linesAlive │ linesAdded │ linesDeleted │ commits │ files │
├───────┼────────────┼────────────┼──────────────┼─────────┼───────┤
│ Alice │ 5200       │ 12000      │ 3000         │ 120     │ 85    │
│ Bob   │ 300        │ 800        │ 200          │ 45      │ 30    │
└───────┴────────────┴────────────┴──────────────┴─────────┴───────┘
```

**Breakdown by file type:**

```bash
$ git-fame --bytype .
┌───────┬────────────┬───────┐
│ group │ linesAlive │ files │
├───────┼────────────┼───────┤
│ .ts   │ 113918     │ 2562  │
│ .tsx  │ 22490      │ 235   │
│ .css  │ 348        │ 18    │
└───────┴────────────┴───────┘
```

**Filter by file type:**

```bash
$ git-fame --include-globs '*.ts,*.tsx' .
```

**Recursive (multiple repos):**

```bash
$ git-fame --recursive ~/work --limit 10
```

**Save to file (format inferred from extension):**

```bash
$ git-fame -o report.json .
$ git-fame -o report.csv .
$ git-fame -o report.md .
```

**Directory output (one file per repo):**

```bash
$ git-fame --recursive --format json -o ./reports/ ~/work
```

**Cross-repo summary:**

```bash
$ git-fame --recursive --summary ~/work
$ git-fame --recursive --summary --format json -o summary.json ~/work
```

## Config file

Create `.gitfamerc` in your repo root to pin default flags:

```json
{
  "format": "table",
  "includeGlobs": ["*.ts", "*.tsx"],
  "excludeGlobs": ["*.test.ts"],
  "limit": 20,
  "sort": "linesAlive"
}
```

CLI flags override config values.

## Library API

```ts
import { analyze, render } from 'git-fame';

const report = await analyze({ path: '/path/to/repo' });
console.log(render(report, 'table'));
```

```ts
import { analyze } from 'git-fame';

const report = await analyze({
  path: '.',
  include: { generated: false },
  includeGlobs: ['*.ts', '*.tsx'],
  groupBy: { type: 'extension', depth: 0 },
});

console.log(JSON.stringify(report, null, 2));
```

**Multi-repo:**

```ts
import { analyzeMany } from 'git-fame';

const reports = await analyzeMany({ path: '/workspace', recursive: true });
```

**Cross-repo summary:**

```ts
import { analyzeMany, summarize, render } from 'git-fame';

const reports = await analyzeMany({ path: '/workspace', recursive: true });
const summary = summarize(reports);
console.log(render(summary, 'table'));
```

## Performance

Benchmarked on a 2800-file TypeScript repo (Apple Silicon):

| Tool              | Time    | vs Python      |
| ----------------- | ------- | -------------- |
| Python git-fame   | 530s    | baseline       |
| **git-fame**      | **11s** | **47x faster** |
| git-fame (cached) | <0.5s   | instant        |

## How it works

1. **Discover** — `git ls-files`, filter binary/generated/minified
2. **Log** — `git log --numstat` for additions/deletions per author
3. **Blame** — parallel `git blame --porcelain -w -M -C` via persistent shell workers
4. **Assemble** — merge into a typed `Report`

## Requirements

- Node.js >= 20
- git installed

## License

MIT
