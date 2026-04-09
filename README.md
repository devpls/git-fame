# node-fame

Fast, accurate git contribution stats — lines, commits, files per author.

Inspired by git-fame (Python), rewritten in TypeScript for correctness and speed.

## Features

- Two metrics: lines alive in HEAD (blame) + lines added/deleted (log)
- Smart defaults: excludes generated files, ignores whitespace changes, follows renames
- Fast: parallel blame, 7-10x faster than git-fame
- Flexible output: table, JSON, CSV, Markdown
- Multi-repo: submodules, recursive workspace analysis
- Library + CLI

## Quick start

```
npx node-fame .
npx node-fame /path/to/repo
npx node-fame --format json .
npx node-fame --include-globs '*.ts' '*.tsx' .
```

## Installation

```
npm install -g node-fame
npm install node-fame
```

## CLI Usage

(Full flag list from --help, formatted as a table or code block)

## Library API

```ts
import { analyze, render } from 'node-fame';
const report = await analyze({ path: '.' });
console.log(render(report, 'table'));
```

## Multi-repo

```ts
import { analyzeMany } from 'node-fame';
const reports = await analyzeMany({ path: '/workspace', recursive: true });
```

## How it works

1. Discover — list files, filter binary/generated
2. Log — git log --numstat
3. Blame — parallel git blame --line-porcelain -w -M -C
4. Assemble — merge into Report

## License

MIT
