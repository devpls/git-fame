export interface BlameFixtureEntry {
  sha: string;
  origLine: number;
  finalLine: number;
  groupCount?: number;
  authorName: string;
  authorMail: string;
  authorTime: number;
  committerName?: string;
  committerMail?: string;
  committerTime?: number;
  summary: string;
  boundary?: boolean;
  filename: string;
  content: string;
}

const formatEntry = (entry: BlameFixtureEntry): string => {
  const headerSuffix = entry.groupCount !== undefined ? ` ${String(entry.groupCount)}` : '';
  const lines = [
    `${entry.sha} ${String(entry.origLine)} ${String(entry.finalLine)}${headerSuffix}`,
    `author ${entry.authorName}`,
    `author-mail <${entry.authorMail}>`,
    `author-time ${String(entry.authorTime)}`,
    `author-tz +0000`,
    `committer ${entry.committerName ?? entry.authorName}`,
    `committer-mail <${entry.committerMail ?? entry.authorMail}>`,
    `committer-time ${String(entry.committerTime ?? entry.authorTime)}`,
    `committer-tz +0000`,
    `summary ${entry.summary}`,
  ];
  if (entry.boundary === true) {
    lines.push('boundary');
  }
  lines.push(`filename ${entry.filename}`);
  lines.push(`\t${entry.content}`);
  return lines.join('\n');
};

export const buildBlameFixture = (entries: BlameFixtureEntry[]): string => {
  return entries.map(formatEntry).join('\n') + '\n';
};
