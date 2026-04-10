# .node-famerc Config File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load per-repo `.node-famerc` JSON config and merge it with CLI flags (CLI wins on conflict).

**Architecture:** A `loadConfig(repoPath)` function reads and parses `.node-famerc`. `parseFlags` in the CLI merges config values as defaults under CLI flags.

**Tech Stack:** TypeScript 6, vitest 4, `node:fs`.

**Commit style:** Single-line, plain English, no prefix, no Co-Authored-By.

---

## File structure

### New files

| Path                                      | Responsibility                             |
| ----------------------------------------- | ------------------------------------------ |
| `src/internal/config/load-config.ts`      | Read + parse `.node-famerc` from repo root |
| `src/internal/config/load-config.test.ts` | Unit tests                                 |

### Modified files

| Path                 | What changes                     |
| -------------------- | -------------------------------- |
| `cli/parse-flags.ts` | Load config, merge with CLI opts |

---

## Task 1: loadConfig

Read `.node-famerc` from a directory, return a typed partial config object.

**Files:**

- Create: `src/internal/config/load-config.ts`
- Create: `src/internal/config/load-config.test.ts`

- [ ] **Step 1: Write tests**

Create `src/internal/config/load-config.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d !== undefined) rmSync(d, { recursive: true, force: true });
    }
  });

  it('returns empty object when .node-famerc does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    expect(loadConfig(dir)).toEqual({});
  });

  it('parses valid JSON config', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(
      join(dir, '.node-famerc'),
      JSON.stringify({
        format: 'json',
        sort: 'commits',
        limit: 5,
        includeGlobs: ['**/*.ts'],
        followRenames: false,
      }),
      'utf8',
    );

    const config = loadConfig(dir);
    expect(config.format).toBe('json');
    expect(config.sort).toBe('commits');
    expect(config.limit).toBe(5);
    expect(config.includeGlobs).toEqual(['**/*.ts']);
    expect(config.followRenames).toBe(false);
  });

  it('throws on malformed JSON with descriptive message', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(join(dir, '.node-famerc'), '{bad json', 'utf8');
    expect(() => loadConfig(dir)).toThrow('Failed to parse .node-famerc');
  });

  it('ignores unknown fields', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(
      join(dir, '.node-famerc'),
      JSON.stringify({
        format: 'csv',
        unknownField: 42,
        anotherUnknown: true,
      }),
      'utf8',
    );

    const config = loadConfig(dir);
    expect(config.format).toBe('csv');
    expect(config).not.toHaveProperty('unknownField');
    expect(config).not.toHaveProperty('anotherUnknown');
  });

  it('returns empty object for empty JSON object', () => {
    const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
    dirs.push(dir);
    writeFileSync(join(dir, '.node-famerc'), '{}', 'utf8');
    expect(loadConfig(dir)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/internal/config/load-config.test.ts
```

- [ ] **Step 3: Implement loadConfig**

Create `src/internal/config/load-config.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface NodeFameConfig {
  format?: string;
  sort?: string;
  limit?: number;
  rev?: string;
  from?: string;
  to?: string;
  since?: string;
  until?: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  includeWhitespace?: boolean;
  includeBinary?: boolean;
  includeGenerated?: boolean;
  excludeMinified?: boolean;
  followRenames?: boolean;
  mailmap?: boolean;
  cache?: boolean;
  concurrency?: number;
  submodules?: boolean;
  splitSubmodules?: boolean;
  recursive?: boolean;
}

const KNOWN_KEYS = new Set<string>([
  'format',
  'sort',
  'limit',
  'rev',
  'from',
  'to',
  'since',
  'until',
  'includeGlobs',
  'excludeGlobs',
  'includeWhitespace',
  'includeBinary',
  'includeGenerated',
  'excludeMinified',
  'followRenames',
  'mailmap',
  'cache',
  'concurrency',
  'submodules',
  'splitSubmodules',
  'recursive',
]);

export const loadConfig = (repoPath: string): NodeFameConfig => {
  const configPath = join(repoPath, '.node-famerc');

  if (!existsSync(configPath)) {
    return {};
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse .node-famerc: ${message}`);
  }

  const config: NodeFameConfig = {};

  for (const key of Object.keys(raw)) {
    if (KNOWN_KEYS.has(key)) {
      (config as Record<string, unknown>)[key] = raw[key];
    }
  }

  return config;
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/internal/config/load-config.test.ts
```

Expected: 5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/internal/config/
git commit -m "Add .node-famerc config file loader"
```

---

## Task 2: Merge config into CLI

Load config in `parseFlags`, merge with CLI opts. CLI flags override config.

**Files:**

- Modify: `cli/parse-flags.ts`

- [ ] **Step 1: Read parse-flags.ts**

Read `cli/parse-flags.ts` to understand current structure.

- [ ] **Step 2: Add config loading and merge**

Add import at the top:

```ts
import { loadConfig } from '../src/internal/config/load-config.js';
```

After `const path = program.args[0] ?? process.cwd();` (line 48), load config:

```ts
const config = loadConfig(path);
```

Now merge config values as fallbacks. The key insight: Commander sets `opts.X` to `undefined` when a flag is NOT passed, and to the explicit value when it IS passed. For `--no-X` flags, Commander sets `true` by default and `false` when `--no-X` is used.

Update the `include` block to use config as fallback:

```ts
const include: AnalyzeOptions['include'] = {
  whitespace: (opts.includeWhitespace as boolean | undefined) ?? config.includeWhitespace ?? false,
  binary: (opts.includeBinary as boolean | undefined) ?? config.includeBinary ?? false,
  generated: (opts.includeGenerated as boolean | undefined) ?? config.includeGenerated ?? false,
};
if ((opts.excludeMinified as boolean | undefined) === true || config.excludeMinified === true) {
  include.minified = false;
}
```

For `--no-follow-renames` and `--no-mailmap`: Commander defaults these to `true`. We can only detect "user explicitly passed `--no-follow-renames`" by checking if the value is `false`. If Commander says `true`, it could be either the default or explicit `--follow-renames`. For config merge, treat Commander `true` as "not overridden" and fall through to config:

```ts
const analyzeOptions: AnalyzeOptions = {
  path,
  include,
  options: {
    followRenames: config.followRenames ?? (opts.followRenames as boolean),
    applyMailmap: config.mailmap ?? (opts.mailmap as boolean),
  },
};
```

Wait — this is wrong. If the user passes `--no-follow-renames` on CLI, `opts.followRenames` is `false`. Config should NOT override that. The correct logic: CLI `false` means explicit override. Commander `true` is ambiguous (could be default). So:

For boolean flags that default to `true` via `--no-` convention:

- `opts.followRenames === false` → user passed `--no-follow-renames` → use `false`
- `opts.followRenames === true` → could be default → check config → fall back to `true`

```ts
    options: {
      followRenames: (opts.followRenames as boolean) === false ? false : (config.followRenames ?? true),
      applyMailmap: (opts.mailmap as boolean) === false ? false : (config.mailmap ?? true),
    },
```

For `--cache` (same `--no-` pattern):

```ts
analyzeOptions.cache = (opts.cache as boolean) === false ? false : (config.cache ?? true);
```

For optional string/array/number fields — only apply config if CLI didn't set them:

```ts
const cliGlobs = opts.includeGlobs as string[] | undefined;
if (cliGlobs !== undefined) {
  analyzeOptions.includeGlobs = cliGlobs;
} else if (config.includeGlobs !== undefined) {
  analyzeOptions.includeGlobs = config.includeGlobs;
}

const cliExclude = opts.excludeGlobs as string[] | undefined;
if (cliExclude !== undefined) {
  analyzeOptions.excludeGlobs = cliExclude;
} else if (config.excludeGlobs !== undefined) {
  analyzeOptions.excludeGlobs = config.excludeGlobs;
}

if ((opts.rev as string | undefined) !== undefined) {
  analyzeOptions.rev = opts.rev as string;
} else if (config.rev !== undefined) {
  analyzeOptions.rev = config.rev;
}
```

For range (`from`/`to`):

```ts
const cliFrom = opts.from as string | undefined;
const cliTo = opts.to as string | undefined;
if (cliFrom !== undefined && cliTo !== undefined) {
  analyzeOptions.range = { from: cliFrom, to: cliTo };
} else if (config.from !== undefined && config.to !== undefined) {
  analyzeOptions.range = { from: config.from, to: config.to };
}
```

For `since`/`until`:

```ts
if ((opts.since as string | undefined) !== undefined) {
  analyzeOptions.since = new Date(opts.since as string);
} else if (config.since !== undefined) {
  analyzeOptions.since = new Date(config.since);
}

if ((opts.until as string | undefined) !== undefined) {
  analyzeOptions.until = new Date(opts.until as string);
} else if (config.until !== undefined) {
  analyzeOptions.until = new Date(config.until);
}
```

For concurrency:

```ts
const cliConcurrency = opts.concurrency as number | undefined;
if (cliConcurrency !== undefined && !isNaN(cliConcurrency)) {
  analyzeOptions.concurrency = cliConcurrency;
} else if (config.concurrency !== undefined) {
  analyzeOptions.concurrency = config.concurrency;
}
```

For submodules/recursive/splitSubmodules — merge with config:

```ts
const submodules = (opts.submodules as boolean | undefined) ?? config.submodules ?? false;
const splitSubmodules =
  (opts.splitSubmodules as boolean | undefined) ?? config.splitSubmodules ?? false;
const recursive = (opts.recursive as boolean | undefined) ?? config.recursive ?? false;
```

For format/sort/limit in renderOptions:

```ts
const format =
  (opts.format as string) === 'table' && config.format !== undefined
    ? config.format
    : (opts.format as string);
```

Wait, that's tricky — Commander has `'table'` as the default for `--format`. We can't distinguish "user passed `--format table`" from "default". Simplest: if Commander shows the default value and config has a value, use config. The only reliable way: check if the raw argv contains `--format`.

Actually, simpler approach: after Commander parses, check if the option was explicitly provided by checking `program.getOptionValueSource('format')`:

```ts
const formatSource = program.getOptionValueSource('format');
const format =
  formatSource === 'cli' ? (opts.format as string) : (config.format ?? (opts.format as string));
```

Commander 12+ supports `getOptionValueSource()` which returns `'default'` or `'cli'`. This is the clean way.

Apply the same pattern for `sort`:

```ts
const sortSource = program.getOptionValueSource('sort');
const sort = sortSource === 'cli' ? (opts.sort as string) : (config.sort ?? (opts.sort as string));
```

And `limit`:

```ts
const limitSource = program.getOptionValueSource('limit');
const limit =
  limitSource === 'cli'
    ? (opts.limit as number | undefined)
    : (config.limit ?? (opts.limit as number | undefined));
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 4: Add integration test in parse-flags.test.ts**

Read `cli/parse-flags.test.ts` first. Then add a test that creates a temp dir with `.node-famerc` and verifies config values are picked up:

```ts
it('loads .node-famerc config values', () => {
  const { mkdtempSync, writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { tmpdir } = require('node:os');
  const { randomUUID } = require('node:crypto');

  const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
  writeFileSync(
    join(dir, '.node-famerc'),
    JSON.stringify({
      format: 'json',
      includeGlobs: ['**/*.ts'],
      concurrency: 4,
    }),
    'utf8',
  );

  const result = parseFlags(['node', 'cli', dir]);
  expect(result.format).toBe('json');
  expect(result.options.includeGlobs).toEqual(['**/*.ts']);
  expect(result.options.concurrency).toBe(4);
});

it('CLI flags override .node-famerc', () => {
  const { mkdtempSync, writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { tmpdir } = require('node:os');
  const { randomUUID } = require('node:crypto');

  const dir = mkdtempSync(join(tmpdir(), `cfg-${randomUUID()}-`));
  writeFileSync(
    join(dir, '.node-famerc'),
    JSON.stringify({
      format: 'json',
      concurrency: 4,
    }),
    'utf8',
  );

  const result = parseFlags(['node', 'cli', '--format', 'csv', '--concurrency', '8', dir]);
  expect(result.format).toBe('csv');
  expect(result.options.concurrency).toBe(8);
});
```

- [ ] **Step 5: Run all tests**

```bash
npm run lint && npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add cli/parse-flags.ts cli/parse-flags.test.ts
git commit -m "Merge .node-famerc config with CLI flags"
```
