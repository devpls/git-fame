export interface MutableAuthorStats {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  filesSet: Set<string>;
  firstCommitTime: number | undefined;
  lastCommitTime: number | undefined;
}
