export interface LogCommit {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  files: { path: string; added: number; deleted: number }[];
}
