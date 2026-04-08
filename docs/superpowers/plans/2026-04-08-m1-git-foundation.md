# M1 Git Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the low-level git interaction layer — typed errors, a streaming `spawnGit()` wrapper over `node:child_process.spawn`, a git version check, repo detection, ref/range resolution, and tracked-file listing. Everything needed before the pipeline layer can start issuing real git commands.

**Architecture:** Single responsibility per file. `errors.ts` is the error taxonomy. `internal/git/spawn.ts` is the only file that touches the process-spawning API; all other git wrappers call through it. `tests/helpers/build-repo.ts` is the single source of truth for creating ephemeral git repositories in tests.

**Tech Stack:** TypeScript 6 (strict + noUncheckedIndexedAccess), Node 20+ (`node:child_process`, `node:fs`, `node:os`, `node:path`, `node:crypto`), vitest 4 for testing, zshy (build is untouched in M1).

**Commit style:** Single-line messages, plain English, no semantic prefix, no `Co-Authored-By` trailer. Set by user preference in project memory.

**Context for implementer:** The spec for node-fame lives at `docs/superpowers/specs/2026-04-08-node-fame-design.md`. Read **Section 2** (error classes, AnalyzeOptions semantics), **Section 3** (`internal/git/*` component descriptions and the data-flow diagram), and **Section 4** (AbortSignal semantics) before starting. M0 is complete — the project has TypeScript 6, vitest 4, ESLint 9 flat config, zshy build, and an empty `src/index.ts` exporting `version = '0.1.0'`. This plan extends that baseline.

**Important conventions from M0:**

- **ESM-only package.** All imports in source must use explicit `.js` extensions (e.g. `import { x } from '../../errors.js'`) — the output dist/ is ESM and Node requires explicit extensions at runtime. Test files under `tests/` may omit extensions because vitest handles resolution, but for consistency in M1 we use `.js` everywhere.
- **No path aliases.** `tsconfig.json` has no `paths` field. Use relative imports only.
- **Strict TypeScript.** `noUncheckedIndexedAccess` is on — indexed access on arrays/tuples returns `T | undefined` and must be narrowed before use. `exactOptionalPropertyTypes` is on — optional properties cannot be assigned `undefined` explicitly.
- **ESLint strictTypeChecked** — `@typescript-eslint/no-floating-promises`, `no-misused-promises`, and friends are errors. Every promise must be `await`-ed or `.catch()`-ed.
- **Build is ESM-only via zshy.** You do not need to re-run `npm run build` during M1 development — `npm run lint` and `npm run test:run` are the gates. A final `npm run build` runs in Task 12 as verification.

---

## File structure

| Path                                     | Action | Responsibility                                               |
| ---------------------------------------- | ------ | ------------------------------------------------------------ |
| `src/errors.ts`                          | Create | `NodeFameError` base + 6 subclasses                          |
| `src/index.ts`                           | Modify | Re-export error classes publicly                             |
| `src/internal/git/spawn.ts`              | Create | `spawnGit()` streaming wrapper with AbortSignal + error wrap |
| `src/internal/git/version.ts`            | Create | `assertGitInstalled()`                                       |
| `src/internal/git/repo.ts`               | Create | `isGitRepo()`, `resolveRev()`, `resolveRange()`              |
| `src/internal/git/ls-files.ts`           | Create | `listTrackedFiles()`                                         |
| `tests/helpers/build-repo.ts`            | Create | `buildRepo(script)` ephemeral git repo factory               |
| `tests/unit/errors.test.ts`              | Create | Error class unit tests                                       |
| `tests/helpers/build-repo.test.ts`       | Create | Meta-test of `buildRepo` helper                              |
| `tests/integration/git/spawn.test.ts`    | Create | spawnGit integration tests                                   |
| `tests/integration/git/version.test.ts`  | Create | assertGitInstalled integration tests                         |
| `tests/integration/git/repo.test.ts`     | Create | isGitRepo / resolveRev / resolveRange integration tests      |
| `tests/integration/git/ls-files.test.ts` | Create | listTrackedFiles integration tests                           |

All source files live under `src/internal/git/` and are therefore **not** exported from `src/index.ts` (per the spec's public/private boundary). Only error classes are re-exported publicly from `src/index.ts`.

---

## Task 1: Create error classes

**Files:**

- Create: `src/errors.ts`
- Test: `tests/unit/errors.test.ts`

Per spec Section 2. Seven classes: `NodeFameError` (base), `NotAGitRepoError`, `GitNotInstalledError`, `InvalidRevError`, `ConflictingOptionsError`, `GitCommandError`, `AbortError`. Every class carries a stable `code: string` in snake_case.

- [ ] **Step 1: Write failing tests for all error classes**

Create `tests/unit/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  NodeFameError,
  NotAGitRepoError,
  GitNotInstalledError,
  InvalidRevError,
  ConflictingOptionsError,
  GitCommandError,
  AbortError,
} from '../../src/errors.js';

describe('NodeFameError', () => {
  it('is a subclass of Error', () => {
    const err = new NodeFameError('boom', 'node_fame_error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NodeFameError);
  });

  it('carries message and code', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.message).toBe('boom');
    expect(err.code).toBe('my_code');
  });

  it('sets name to the constructor name', () => {
    const err = new NodeFameError('boom', 'my_code');
    expect(err.name).toBe('NodeFameError');
  });
});

describe('NotAGitRepoError', () => {
  it('extends NodeFameError with code not_a_git_repo', () => {
    const err = new NotAGitRepoError('/some/path');
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('not_a_git_repo');
    expect(err.path).toBe('/some/path');
    expect(err.message).toContain('/some/path');
    expect(err.name).toBe('NotAGitRepoError');
  });
});

describe('GitNotInstalledError', () => {
  it('extends NodeFameError with code git_not_installed', () => {
    const err = new GitNotInstalledError();
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('git_not_installed');
    expect(err.name).toBe('GitNotInstalledError');
  });

  it('accepts a custom message', () => {
    const err = new GitNotInstalledError('git 2.10 is too old');
    expect(err.message).toBe('git 2.10 is too old');
  });
});

describe('InvalidRevError', () => {
  it('extends NodeFameError with code invalid_rev', () => {
    const err = new InvalidRevError('v99.0', '/my/repo');
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('invalid_rev');
    expect(err.rev).toBe('v99.0');
    expect(err.message).toContain('v99.0');
    expect(err.message).toContain('/my/repo');
    expect(err.name).toBe('InvalidRevError');
  });
});

describe('ConflictingOptionsError', () => {
  it('extends NodeFameError with code conflicting_options', () => {
    const err = new ConflictingOptionsError("'rev' and 'range' are mutually exclusive");
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('conflicting_options');
    expect(err.details).toBe("'rev' and 'range' are mutually exclusive");
    expect(err.name).toBe('ConflictingOptionsError');
  });
});

describe('GitCommandError', () => {
  it('extends NodeFameError with code git_command_failed', () => {
    const err = new GitCommandError('git log --numstat', '/my/repo', 'fatal: bad revision', 128);
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('git_command_failed');
    expect(err.cmd).toBe('git log --numstat');
    expect(err.cwd).toBe('/my/repo');
    expect(err.stderr).toBe('fatal: bad revision');
    expect(err.exitCode).toBe(128);
    expect(err.message).toContain('128');
    expect(err.message).toContain('fatal: bad revision');
    expect(err.name).toBe('GitCommandError');
  });

  it('handles empty stderr gracefully', () => {
    const err = new GitCommandError('git status', '/cwd', '', 1);
    expect(err.message).toContain('1');
    expect(err.message).not.toContain('undefined');
  });
});

describe('AbortError', () => {
  it('extends NodeFameError with code aborted', () => {
    const err = new AbortError();
    expect(err).toBeInstanceOf(NodeFameError);
    expect(err.code).toBe('aborted');
    expect(err.name).toBe('AbortError');
  });

  it('accepts a custom message', () => {
    const err = new AbortError('user cancelled');
    expect(err.message).toBe('user cancelled');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/unit/errors.test.ts`
Expected: FAIL with module-not-found errors on `../../src/errors.js`.

- [ ] **Step 3: Implement the error classes**

Create `src/errors.ts`:

```ts
export class NodeFameError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class NotAGitRepoError extends NodeFameError {
  readonly path: string;

  constructor(path: string) {
    super(`${path} is not a git repository`, 'not_a_git_repo');
    this.path = path;
  }
}

export class GitNotInstalledError extends NodeFameError {
  constructor(message = 'git executable not found in PATH') {
    super(message, 'git_not_installed');
  }
}

export class InvalidRevError extends NodeFameError {
  readonly rev: string;

  constructor(rev: string, cwd: string) {
    super(`rev '${rev}' does not exist in ${cwd}`, 'invalid_rev');
    this.rev = rev;
  }
}

export class ConflictingOptionsError extends NodeFameError {
  readonly details: string;

  constructor(details: string) {
    super(details, 'conflicting_options');
    this.details = details;
  }
}

export class GitCommandError extends NodeFameError {
  readonly cmd: string;
  readonly cwd: string;
  readonly stderr: string;
  readonly exitCode: number;

  constructor(cmd: string, cwd: string, stderr: string, exitCode: number) {
    const stderrSummary = stderr.trim() || '(no stderr)';
    super(`${cmd} exited ${exitCode}: ${stderrSummary}`, 'git_command_failed');
    this.cmd = cmd;
    this.cwd = cwd;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class AbortError extends NodeFameError {
  constructor(message = 'analysis aborted') {
    super(message, 'aborted');
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/unit/errors.test.ts`
Expected: all tests green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/errors.ts tests/unit/errors.test.ts
git commit -m "Add typed error classes for git and analysis failures"
```

---

## Task 2: Re-export errors from the public entry

**Files:**

- Modify: `src/index.ts`
- Test: `tests/unit/index.test.ts` (extend existing)

Errors are part of the public API (per spec Section 2). Programmatic consumers do `import { NotAGitRepoError } from 'node-fame'`.

- [ ] **Step 1: Extend the index smoke test**

Replace `tests/unit/index.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  version,
  NodeFameError,
  NotAGitRepoError,
  GitNotInstalledError,
  InvalidRevError,
  ConflictingOptionsError,
  GitCommandError,
  AbortError,
} from '../../src/index.js';

describe('node-fame package entry', () => {
  it('exports a version string', () => {
    expect(typeof version).toBe('string');
  });

  it('version follows semver format (major.minor.patch)', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('re-exports all error classes', () => {
    expect(NodeFameError).toBeDefined();
    expect(NotAGitRepoError).toBeDefined();
    expect(GitNotInstalledError).toBeDefined();
    expect(InvalidRevError).toBeDefined();
    expect(ConflictingOptionsError).toBeDefined();
    expect(GitCommandError).toBeDefined();
    expect(AbortError).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/unit/index.test.ts`
Expected: FAIL — `src/index.js` does not export the error classes yet.

- [ ] **Step 3: Update `src/index.ts` to re-export errors**

Replace the file content:

```ts
export const version = '0.1.0';

export {
  NodeFameError,
  NotAGitRepoError,
  GitNotInstalledError,
  InvalidRevError,
  ConflictingOptionsError,
  GitCommandError,
  AbortError,
} from './errors.js';
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/unit/index.test.ts`
Expected: all green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/unit/index.test.ts
git commit -m "Re-export error classes from public entry"
```

---

## Task 3: Create `buildRepo` test helper

**Files:**

- Create: `tests/helpers/build-repo.ts`
- Test: `tests/helpers/build-repo.test.ts` (meta-test)

Every M1 integration test needs an ephemeral git repository with controlled authors and dates. `buildRepo` is the single place where that construction happens. One helper, many tests.

- [ ] **Step 1: Write the meta-test**

Create `tests/helpers/build-repo.test.ts`:

```ts
import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildRepo, cleanupRepo } from './build-repo.js';

describe('buildRepo', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('creates a git repository in a fresh temp directory', () => {
    const dir = buildRepo([]);
    created.push(dir);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, '.git'))).toBe(true);
  });

  it('applies the requested files in a commit', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hello\n' },
      },
    ]);
    created.push(dir);

    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('hello\n');

    const log = spawnSync('git', ['log', '--pretty=%an|%ae|%aI'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(log.status).toBe(0);
    expect(log.stdout.trim()).toBe('Alice|alice@example.com|2024-01-01T00:00:00+00:00');
  });

  it('supports multiple commits with different authors and dates', () => {
    const dir = buildRepo([
      {
        author: 'Alice <alice@example.com>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\n' },
      },
      {
        author: 'Bob <bob@example.com>',
        date: '2024-01-02T00:00:00Z',
        files: { 'b.txt': 'two\n' },
      },
    ]);
    created.push(dir);

    const log = spawnSync('git', ['log', '--pretty=%an'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(log.stdout.trim().split('\n')).toEqual(['Bob', 'Alice']);
  });

  it('supports deleting files in subsequent commits', () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'gone.txt': 'delete me\n' },
      },
      {
        author: 'Alice <a@x>',
        date: '2024-01-02T00:00:00Z',
        delete: ['gone.txt'],
      },
    ]);
    created.push(dir);
    expect(existsSync(join(dir, 'gone.txt'))).toBe(false);
  });

  it('throws on invalid author format', () => {
    expect(() =>
      buildRepo([
        {
          author: 'no-email-format',
          date: '2024-01-01T00:00:00Z',
          files: { 'a.txt': 'x\n' },
        },
      ]),
    ).toThrow(/author/i);
  });

  it('cleanupRepo removes the directory', () => {
    const dir = buildRepo([]);
    expect(existsSync(dir)).toBe(true);
    cleanupRepo(dir);
    expect(existsSync(dir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/helpers/build-repo.test.ts`
Expected: FAIL — `./build-repo.js` does not exist.

- [ ] **Step 3: Implement the helper**

Create `tests/helpers/build-repo.ts`:

```ts
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export type CommitScript = {
  author: string; // 'Name <email@host>'
  date: string; // ISO-8601 or any git-parseable date string
  files?: Record<string, string>;
  delete?: string[];
  message?: string;
};

export type RepoScript = CommitScript[];

export function buildRepo(script: RepoScript): string {
  const dir = mkdtempSync(join(tmpdir(), `node-fame-test-${randomUUID()}-`));

  runGit(['init', '--initial-branch=main'], dir, process.env);
  runGit(['config', 'user.name', 'Test'], dir, process.env);
  runGit(['config', 'user.email', 'test@example.com'], dir, process.env);
  runGit(['config', 'commit.gpgsign', 'false'], dir, process.env);

  for (const commit of script) {
    const authorMatch = /^(.+?) <(.+?)>$/.exec(commit.author);
    if (authorMatch === null) {
      throw new Error(`Invalid author format: ${commit.author}`);
    }
    const name = authorMatch[1] ?? '';
    const email = authorMatch[2] ?? '';

    if (commit.files !== undefined) {
      for (const [relPath, content] of Object.entries(commit.files)) {
        const full = join(dir, relPath);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content, 'utf8');
        runGit(['add', relPath], dir, process.env);
      }
    }

    if (commit.delete !== undefined) {
      for (const relPath of commit.delete) {
        runGit(['rm', relPath], dir, process.env);
      }
    }

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_AUTHOR_DATE: commit.date,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
      GIT_COMMITTER_DATE: commit.date,
    };

    runGit(['commit', '-m', commit.message ?? 'commit', '--allow-empty'], dir, env);
  }

  return dir;
}

export function cleanupRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function runGit(args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (exit ${String(result.status)}): ${result.stderr}`,
    );
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/helpers/build-repo.test.ts`
Expected: all 6 test cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/build-repo.ts tests/helpers/build-repo.test.ts
git commit -m "Add buildRepo test helper for ephemeral git fixtures"
```

---

## Task 4: `spawnGit` happy-path test and basic implementation

**Files:**

- Create: `src/internal/git/spawn.ts`
- Test: `tests/integration/git/spawn.test.ts`

Per spec Section 3 — the only file in the project that touches the process-spawning API from `node:child_process`. Every other git wrapper depends on it. Environment overrides `LC_ALL=C` and `GIT_OPTIONAL_LOCKS=0` per the spec's invariants.

We build this in three incremental tasks (4, 5, 6): happy path → error wrapping → abort handling. Each adds one behavioural dimension with its own test.

- [ ] **Step 1: Write the happy-path test**

Create `tests/integration/git/spawn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { spawnGit } from '../../../src/internal/git/spawn.js';

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('spawnGit', () => {
  it('runs git --version and streams stdout', async () => {
    const result = spawnGit(['--version'], process.cwd());
    const [output] = await Promise.all([collect(result.stdout), result.done]);
    expect(output).toMatch(/^git version /);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: FAIL — `spawn.js` does not exist.

- [ ] **Step 3: Implement the minimal happy-path wrapper**

Create `src/internal/git/spawn.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';

export type SpawnGitResult = {
  stdout: Readable;
  done: Promise<void>;
};

const GIT_ENV_OVERRIDES = {
  LC_ALL: 'C',
  GIT_OPTIONAL_LOCKS: '0',
};

export function spawnGit(args: readonly string[], cwd: string): SpawnGitResult {
  const child: ChildProcess = spawn('git', [...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV_OVERRIDES },
  });

  if (child.stdout === null) {
    throw new Error('spawnGit: stdout pipe is null');
  }
  const stdout = child.stdout;

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(' ')} exited with code ${String(code)}`));
      }
    });
  });

  return { stdout, done };
}
```

Note: this intentionally does **not** handle errors cleanly or AbortSignal yet. Task 5 and Task 6 add those layers via TDD.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: the one test case passes.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/spawn.ts tests/integration/git/spawn.test.ts
git commit -m "Add basic spawnGit streaming wrapper"
```

---

## Task 5: `spawnGit` wraps non-zero exits in `GitCommandError`

**Files:**

- Modify: `src/internal/git/spawn.ts`
- Modify: `tests/integration/git/spawn.test.ts`

- [ ] **Step 1: Add a failing test for the error-wrapping behaviour**

Append to `tests/integration/git/spawn.test.ts` (inside the existing `describe('spawnGit', ...)` block, before the closing `})`):

```ts
it('rejects done with GitCommandError on non-zero exit', async () => {
  const { GitCommandError } = await import('../../../src/errors.js');
  const result = spawnGit(['not-a-real-git-command'], process.cwd());
  // Drain stdout to avoid a stuck pipe
  result.stdout.resume();
  await expect(result.done).rejects.toBeInstanceOf(GitCommandError);
});

it('GitCommandError carries cmd, cwd, stderr, and exit code', async () => {
  const { GitCommandError } = await import('../../../src/errors.js');
  const result = spawnGit(['not-a-real-git-command'], process.cwd());
  result.stdout.resume();
  try {
    await result.done;
    throw new Error('expected rejection');
  } catch (err) {
    expect(err).toBeInstanceOf(GitCommandError);
    const typed = err as InstanceType<typeof GitCommandError>;
    expect(typed.cmd).toBe('git not-a-real-git-command');
    expect(typed.cwd).toBe(process.cwd());
    expect(typed.exitCode).toBeGreaterThan(0);
    expect(typed.stderr.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: the first spec still passes. The two new specs fail — `spawnGit` currently rejects with a plain `Error`, not a `GitCommandError`.

- [ ] **Step 3: Update `spawn.ts` to capture stderr and wrap non-zero exits**

Replace the contents of `src/internal/git/spawn.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { GitCommandError } from '../../errors.js';

export type SpawnGitResult = {
  stdout: Readable;
  done: Promise<void>;
};

const GIT_ENV_OVERRIDES = {
  LC_ALL: 'C',
  GIT_OPTIONAL_LOCKS: '0',
};

export function spawnGit(args: readonly string[], cwd: string): SpawnGitResult {
  const child: ChildProcess = spawn('git', [...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV_OVERRIDES },
  });

  if (child.stdout === null) {
    throw new Error('spawnGit: stdout pipe is null');
  }
  const stdout = child.stdout;

  const stderrChunks: Buffer[] = [];
  if (child.stderr !== null) {
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
  }

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      reject(new GitCommandError(`git ${args.join(' ')}`, cwd, stderr, code ?? -1));
    });
  });

  return { stdout, done };
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: all three cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/spawn.ts tests/integration/git/spawn.test.ts
git commit -m "Wrap spawnGit non-zero exits in GitCommandError"
```

---

## Task 6: `spawnGit` honours `AbortSignal`

**Files:**

- Modify: `src/internal/git/spawn.ts`
- Modify: `tests/integration/git/spawn.test.ts`

Per spec Section 4: pre-aborted signal → throw immediately; abort during execution → `SIGTERM`, 500ms grace, `SIGKILL`, reject `done` with `AbortError`; listener cleanup in finally.

- [ ] **Step 1: Add failing tests for abort behaviour**

Append to `tests/integration/git/spawn.test.ts` (inside the `describe` block):

```ts
it('throws AbortError immediately when signal is already aborted', async () => {
  const { AbortError } = await import('../../../src/errors.js');
  const controller = new AbortController();
  controller.abort();
  expect(() => spawnGit(['--version'], process.cwd(), controller.signal)).toThrow(AbortError);
});

it('rejects done with AbortError when signal aborts mid-execution', async () => {
  const { AbortError } = await import('../../../src/errors.js');
  const controller = new AbortController();
  // git log --all is cheap but nontrivial; give it time to start
  const result = spawnGit(['log', '--all', '--pretty=format:%H'], process.cwd(), controller.signal);
  result.stdout.resume();
  setTimeout(() => {
    controller.abort();
  }, 10);
  await expect(result.done).rejects.toBeInstanceOf(AbortError);
});

it('accepts no signal (backwards-compatible two-arg call shape)', async () => {
  // Ensures the two-arg call shape still works after signal is added
  const result = spawnGit(['--version'], process.cwd());
  result.stdout.resume();
  await expect(result.done).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: the two abort-related tests fail. The backwards-compat test may pass or fail depending on how the signature is shaped.

- [ ] **Step 3: Update `spawn.ts` with AbortSignal support**

Replace the contents of `src/internal/git/spawn.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { AbortError, GitCommandError } from '../../errors.js';

export type SpawnGitResult = {
  stdout: Readable;
  done: Promise<void>;
};

const GIT_ENV_OVERRIDES = {
  LC_ALL: 'C',
  GIT_OPTIONAL_LOCKS: '0',
};

const SIGKILL_GRACE_MS = 500;

export function spawnGit(
  args: readonly string[],
  cwd: string,
  signal?: AbortSignal,
): SpawnGitResult {
  if (signal?.aborted === true) {
    throw new AbortError();
  }

  const child: ChildProcess = spawn('git', [...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...GIT_ENV_OVERRIDES },
  });

  if (child.stdout === null) {
    throw new Error('spawnGit: stdout pipe is null');
  }
  const stdout = child.stdout;

  const stderrChunks: Buffer[] = [];
  if (child.stderr !== null) {
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
  }

  const done = new Promise<void>((resolve, reject) => {
    let aborted = false;
    let killTimer: NodeJS.Timeout | undefined;

    const onAbort = (): void => {
      aborted = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.killed !== true) {
          child.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_MS);
      killTimer.unref();
    };

    if (signal !== undefined) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = (): void => {
      if (signal !== undefined) {
        signal.removeEventListener('abort', onAbort);
      }
      if (killTimer !== undefined) {
        clearTimeout(killTimer);
      }
    };

    child.on('error', (err) => {
      cleanup();
      reject(err);
    });

    child.on('close', (code) => {
      cleanup();
      if (aborted) {
        reject(new AbortError());
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      reject(new GitCommandError(`git ${args.join(' ')}`, cwd, stderr, code ?? -1));
    });
  });

  return { stdout, done };
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run tests/integration/git/spawn.test.ts`
Expected: all six cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/spawn.ts tests/integration/git/spawn.test.ts
git commit -m "Propagate AbortSignal through spawnGit"
```

---

## Task 7: `assertGitInstalled` — version check

**Files:**

- Create: `src/internal/git/version.ts`
- Test: `tests/integration/git/version.test.ts`

Per spec Section 4: if git is missing or too old, throw `GitNotInstalledError`. Minimum version is 2.30.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/git/version.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertGitInstalled } from '../../../src/internal/git/version.js';

describe('assertGitInstalled', () => {
  it('resolves when git is installed and recent enough', async () => {
    await expect(assertGitInstalled()).resolves.toBeUndefined();
  });
});
```

Note: this plan does not add a "git is missing" test case in M1. Simulating a missing git binary requires PATH manipulation or injecting `spawnGit` as a dependency, both of which are plumbing that belongs in a later hardening pass. The happy path is covered here; failure paths (missing, too old) are exercised later when we have a proper DI test seam.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/integration/git/version.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the version check**

Create `src/internal/git/version.ts`:

```ts
import { spawnGit } from './spawn.js';
import { GitNotInstalledError } from '../../errors.js';

const MIN_GIT_MAJOR = 2;
const MIN_GIT_MINOR = 30;

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function assertGitInstalled(): Promise<void> {
  let output: string;
  try {
    const result = spawnGit(['--version'], process.cwd());
    const [text] = await Promise.all([collect(result.stdout), result.done]);
    output = text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GitNotInstalledError(`failed to run git --version: ${message}`);
  }

  const versionMatch = /git version (\d+)\.(\d+)/.exec(output);
  if (versionMatch === null) {
    throw new GitNotInstalledError(`could not parse git version from output: ${output.trim()}`);
  }

  const majorStr = versionMatch[1] ?? '0';
  const minorStr = versionMatch[2] ?? '0';
  const major = Number(majorStr);
  const minor = Number(minorStr);

  if (major < MIN_GIT_MAJOR || (major === MIN_GIT_MAJOR && minor < MIN_GIT_MINOR)) {
    throw new GitNotInstalledError(
      `git ${String(major)}.${String(minor)} is too old; need ${String(MIN_GIT_MAJOR)}.${String(MIN_GIT_MINOR)}+`,
    );
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/integration/git/version.test.ts`
Expected: green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/version.ts tests/integration/git/version.test.ts
git commit -m "Add assertGitInstalled with minimum version check"
```

---

## Task 8: `isGitRepo` — path check

**Files:**

- Create: `src/internal/git/repo.ts`
- Test: `tests/integration/git/repo.test.ts`

Checks for a `.git` directory or file (submodule case) at the given path. Pure filesystem check, no git invocation.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/git/repo.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isGitRepo } from '../../../src/internal/git/repo.js';
import { buildRepo } from '../../helpers/build-repo.js';

describe('isGitRepo', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns true for a freshly initialised git repository', () => {
    const dir = buildRepo([]);
    created.push(dir);
    expect(isGitRepo(dir)).toBe(true);
  });

  it('returns false for a non-git directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-nongit-'));
    created.push(dir);
    expect(isGitRepo(dir)).toBe(false);
  });

  it('returns false for a non-existent path', () => {
    expect(isGitRepo('/this/path/does/not/exist/ever')).toBe(false);
  });

  it('returns true when .git is a file (submodule layout)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-sub-'));
    created.push(dir);
    writeFileSync(join(dir, '.git'), 'gitdir: ../.git/modules/sub\n', 'utf8');
    expect(isGitRepo(dir)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: FAIL — `repo.js` does not exist.

- [ ] **Step 3: Implement `isGitRepo`**

Create `src/internal/git/repo.ts`:

```ts
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function isGitRepo(path: string): boolean {
  const gitPath = join(path, '.git');
  if (!existsSync(gitPath)) {
    return false;
  }
  const stat = statSync(gitPath);
  // .git is a directory in normal repos and a file (gitlink) in submodules.
  return stat.isDirectory() || stat.isFile();
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: 4 test cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/repo.ts tests/integration/git/repo.test.ts
git commit -m "Add isGitRepo path check"
```

---

## Task 9: `resolveRev` — single-ref resolution

**Files:**

- Modify: `src/internal/git/repo.ts`
- Modify: `tests/integration/git/repo.test.ts`

Uses `git rev-parse --verify <rev>^{commit}` to both validate the rev and resolve it to a SHA. Throws `NotAGitRepoError` if the path is not a git repo, `InvalidRevError` if the rev does not exist.

- [ ] **Step 1: Add failing tests for `resolveRev`**

Append to `tests/integration/git/repo.test.ts` — add new `describe` block after the `isGitRepo` block:

```ts
describe('resolveRev', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('resolves HEAD to a commit SHA', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const sha = await resolveRev(dir, 'HEAD');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('resolves a branch name', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const sha = await resolveRev(dir, 'main');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('throws NotAGitRepoError for a non-repo directory', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const { NotAGitRepoError } = await import('../../../src/errors.js');
    const dir = mkdtempSync(join(tmpdir(), 'node-fame-nongit-'));
    created.push(dir);
    await expect(resolveRev(dir, 'HEAD')).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('throws InvalidRevError for a non-existent ref', async () => {
    const { resolveRev } = await import('../../../src/internal/git/repo.js');
    const { InvalidRevError } = await import('../../../src/errors.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    await expect(resolveRev(dir, 'v99.0.0')).rejects.toBeInstanceOf(InvalidRevError);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: the new `resolveRev` tests fail — the function does not exist yet.

- [ ] **Step 3: Add `resolveRev` to `repo.ts`**

Replace the contents of `src/internal/git/repo.ts`:

```ts
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnGit } from './spawn.js';
import { GitCommandError, InvalidRevError, NotAGitRepoError } from '../../errors.js';

export function isGitRepo(path: string): boolean {
  const gitPath = join(path, '.git');
  if (!existsSync(gitPath)) {
    return false;
  }
  const stat = statSync(gitPath);
  return stat.isDirectory() || stat.isFile();
}

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function resolveRev(cwd: string, rev: string): Promise<string> {
  if (!isGitRepo(cwd)) {
    throw new NotAGitRepoError(cwd);
  }

  try {
    const result = spawnGit(['rev-parse', '--verify', `${rev}^{commit}`], cwd);
    const [text] = await Promise.all([collect(result.stdout), result.done]);
    return text.trim();
  } catch (err) {
    if (err instanceof GitCommandError) {
      throw new InvalidRevError(rev, cwd);
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: all `isGitRepo` and `resolveRev` test cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/repo.ts tests/integration/git/repo.test.ts
git commit -m "Add resolveRev with rev-parse verification"
```

---

## Task 10: `resolveRange` — two-ref resolution

**Files:**

- Modify: `src/internal/git/repo.ts`
- Modify: `tests/integration/git/repo.test.ts`

Resolves `{ from, to }` to `{ fromSha, toSha }` by calling `resolveRev` twice in parallel.

- [ ] **Step 1: Add failing tests**

Append a new `describe` block to `tests/integration/git/repo.test.ts`:

```ts
describe('resolveRange', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('resolves both endpoints to SHAs', async () => {
    const { resolveRange } = await import('../../../src/internal/git/repo.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'one\n' },
      },
      {
        author: 'Alice <a@x>',
        date: '2024-01-02T00:00:00Z',
        files: { 'a.txt': 'two\n' },
      },
    ]);
    created.push(dir);

    // Tag the first commit so we have a named endpoint
    const { spawnSync } = await import('node:child_process');
    spawnSync('git', ['tag', 'v1', 'HEAD~1'], { cwd: dir });

    const range = await resolveRange(dir, { from: 'v1', to: 'HEAD' });
    expect(range.fromSha).toMatch(/^[0-9a-f]{40}$/);
    expect(range.toSha).toMatch(/^[0-9a-f]{40}$/);
    expect(range.fromSha).not.toBe(range.toSha);
  });

  it('throws InvalidRevError if either endpoint is invalid', async () => {
    const { resolveRange } = await import('../../../src/internal/git/repo.js');
    const { InvalidRevError } = await import('../../../src/errors.js');
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'x\n' },
      },
    ]);
    created.push(dir);
    await expect(resolveRange(dir, { from: 'HEAD', to: 'v99' })).rejects.toBeInstanceOf(
      InvalidRevError,
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: new `resolveRange` tests fail — function does not exist.

- [ ] **Step 3: Add `resolveRange` to `repo.ts`**

Append to `src/internal/git/repo.ts` (below `resolveRev`):

```ts
export type Range = { from: string; to: string };
export type ResolvedRange = { fromSha: string; toSha: string };

export async function resolveRange(cwd: string, range: Range): Promise<ResolvedRange> {
  const [fromSha, toSha] = await Promise.all([
    resolveRev(cwd, range.from),
    resolveRev(cwd, range.to),
  ]);
  return { fromSha, toSha };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/integration/git/repo.test.ts`
Expected: all cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/repo.ts tests/integration/git/repo.test.ts
git commit -m "Add resolveRange for from/to endpoint pair"
```

---

## Task 11: `listTrackedFiles` — enumerate files in a ref

**Files:**

- Create: `src/internal/git/ls-files.ts`
- Test: `tests/integration/git/ls-files.test.ts`

Uses `git ls-files -z` and splits on NUL. Returns `string[]` — bounded in size (path list, not file contents), so buffering is fine here per the spec's streaming notes.

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/git/ls-files.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { listTrackedFiles } from '../../../src/internal/git/ls-files.js';
import { buildRepo } from '../../helpers/build-repo.js';

describe('listTrackedFiles', () => {
  const created: string[] = [];
  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns an empty array for an empty repo', async () => {
    const dir = buildRepo([]);
    created.push(dir);
    // buildRepo leaves an orphan branch with no commits if script is empty.
    // ls-files on such a repo returns nothing — valid input, empty output.
    const files = await listTrackedFiles(dir);
    expect(files).toEqual([]);
  });

  it('lists a single tracked file', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: { 'a.txt': 'hi\n' },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files).toEqual(['a.txt']);
  });

  it('lists multiple files including subdirectories', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: {
          'a.txt': 'x\n',
          'src/b.ts': 'export {};\n',
          'src/nested/c.ts': 'export {};\n',
        },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files.sort()).toEqual(['a.txt', 'src/b.ts', 'src/nested/c.ts']);
  });

  it('handles file names with unusual characters', async () => {
    const dir = buildRepo([
      {
        author: 'Alice <a@x>',
        date: '2024-01-01T00:00:00Z',
        files: {
          'normal.txt': 'x\n',
          'with spaces.txt': 'y\n',
          'unicode-файл.txt': 'z\n',
        },
      },
    ]);
    created.push(dir);
    const files = await listTrackedFiles(dir);
    expect(files.sort()).toEqual(['normal.txt', 'unicode-файл.txt', 'with spaces.txt'].sort());
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/integration/git/ls-files.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `listTrackedFiles`**

Create `src/internal/git/ls-files.ts`:

```ts
import { spawnGit } from './spawn.js';

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function listTrackedFiles(cwd: string, signal?: AbortSignal): Promise<string[]> {
  const result = spawnGit(['ls-files', '-z'], cwd, signal);
  const [text] = await Promise.all([collect(result.stdout), result.done]);
  if (text.length === 0) {
    return [];
  }
  return text.split('\0').filter((p) => p.length > 0);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/integration/git/ls-files.test.ts`
Expected: all 4 cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/internal/git/ls-files.ts tests/integration/git/ls-files.test.ts
git commit -m "Add listTrackedFiles via git ls-files -z"
```

---

## Task 12: Final M1 verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all unit and integration tests pass. Count should be roughly 30–35 test cases across the seven new test files.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Run coverage to verify M1 modules are exercised**

Run: `npm run coverage`
Expected: exits 0. Coverage for `src/errors.ts` and every file under `src/internal/git/` should be high (≥ 90% lines). Core files like `errors.ts`, `repo.ts`, `ls-files.ts` should be at 100%.

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: exits 0, `dist/` populated with the new modules. Specifically verify:

```bash
ls dist/internal/git/
```

Expected: `spawn.js`, `version.js`, `repo.js`, `ls-files.js` plus their `.d.ts` counterparts.

- [ ] **Step 5: Smoke-test a runtime import of the built public API**

Run:

```bash
node -e "import('./dist/index.js').then(m => { console.log('version:', m.version); console.log('NotAGitRepoError:', typeof m.NotAGitRepoError); })"
```

Expected output:

```
version: 0.1.0
NotAGitRepoError: function
```

- [ ] **Step 6: Verify git status is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 7: Verify commit history**

Run: `git log --oneline feat/initial ^main | head -20`
Expected: eleven new commits layered on top of the M0 commits, one per Task 1–11. Task 12 is verification-only and produces no commit.
