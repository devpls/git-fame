import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CommitScript {
  author: string; // 'Name <email@host>'
  date: string; // ISO-8601 or any git-parseable date string
  files?: Record<string, string>;
  delete?: string[];
  message?: string;
}

export type RepoScript = CommitScript[];

const runGit = (args: string[], cwd: string, env: NodeJS.ProcessEnv): void => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (exit ${String(result.status)}): ${result.stderr}`,
    );
  }
};

export const buildRepo = (script: RepoScript): string => {
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
};
