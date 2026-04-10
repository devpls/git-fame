export interface AuthorStats {
  name: string;
  email: string;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  files: number;
  firstCommit: Date;
  lastCommit: Date;
  breakdown?: Record<string, number>;
}
