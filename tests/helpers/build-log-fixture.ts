export interface LogFixtureFile {
  added: number | '-';
  deleted: number | '-';
  path: string;
}

export interface LogFixtureCommit {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  files: LogFixtureFile[];
}

const formatCommit = (commit: LogFixtureCommit): string => {
  const header =
    `${commit.sha}\x00${commit.authorName}\x00${commit.authorMail}\x00` + String(commit.authorTime);
  const fileLines = commit.files.map((f) => `${String(f.added)}\t${String(f.deleted)}\t${f.path}`);
  return [header, ...fileLines].join('\n') + '\n';
};

export const buildLogFixture = (commits: LogFixtureCommit[]): string => {
  if (commits.length === 0) {
    return '';
  }
  return commits.map(formatCommit).join('\n');
};
