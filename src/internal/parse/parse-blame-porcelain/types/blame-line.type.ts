export interface BlameLine {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  line: string;
  isBoundary: boolean;
}
