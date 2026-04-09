import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RepoWithSubmodule {
  parentDir: string;
  submoduleDir: string;
  submoduleName: string;
}

const runGit = (args: string[], cwd: string, env: NodeJS.ProcessEnv): void => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (exit ${String(result.status)}): ${result.stderr}`,
    );
  }
};

export const buildRepoWithSubmodule = (): RepoWithSubmodule => {
  const base = mkdtempSync(join(tmpdir(), `node-fame-submodule-${randomUUID()}-`));
  const libDir = join(base, 'lib-repo');
  const parentDir = join(base, 'parent-repo');

  const baseEnv = { ...process.env };

  // Build the library repo
  runGit(['init', '--initial-branch=main', libDir], base, baseEnv);
  runGit(['config', 'user.name', 'LibAuthor'], libDir, baseEnv);
  runGit(['config', 'user.email', 'lib@example.com'], libDir, baseEnv);
  runGit(['config', 'commit.gpgsign', 'false'], libDir, baseEnv);

  writeFileSync(join(libDir, 'lib.txt'), 'library content\n', 'utf8');
  runGit(['add', 'lib.txt'], libDir, baseEnv);

  const libEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    GIT_AUTHOR_NAME: 'LibAuthor',
    GIT_AUTHOR_EMAIL: 'lib@example.com',
    GIT_AUTHOR_DATE: '2024-01-01T00:00:00Z',
    GIT_COMMITTER_NAME: 'LibAuthor',
    GIT_COMMITTER_EMAIL: 'lib@example.com',
    GIT_COMMITTER_DATE: '2024-01-01T00:00:00Z',
  };
  runGit(['commit', '-m', 'Add lib.txt'], libDir, libEnv);

  // Build the parent repo
  runGit(['init', '--initial-branch=main', parentDir], base, baseEnv);
  runGit(['config', 'user.name', 'ParentAuthor'], parentDir, baseEnv);
  runGit(['config', 'user.email', 'parent@example.com'], parentDir, baseEnv);
  runGit(['config', 'commit.gpgsign', 'false'], parentDir, baseEnv);

  writeFileSync(join(parentDir, 'parent.txt'), 'parent content\n', 'utf8');
  runGit(['add', 'parent.txt'], parentDir, baseEnv);

  const parentEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    GIT_AUTHOR_NAME: 'ParentAuthor',
    GIT_AUTHOR_EMAIL: 'parent@example.com',
    GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z',
    GIT_COMMITTER_NAME: 'ParentAuthor',
    GIT_COMMITTER_EMAIL: 'parent@example.com',
    GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z',
  };
  runGit(['commit', '-m', 'Add parent.txt'], parentDir, parentEnv);

  // Add the library as a submodule named "lib"
  const submoduleName = 'lib';
  runGit(
    [
      '-c',
      'protocol.file.allow=always',
      'submodule',
      'add',
      '--name',
      submoduleName,
      libDir,
      submoduleName,
    ],
    parentDir,
    parentEnv,
  );
  runGit(['commit', '-m', 'Add lib submodule'], parentDir, parentEnv);

  return { parentDir, submoduleDir: join(parentDir, submoduleName), submoduleName };
};
