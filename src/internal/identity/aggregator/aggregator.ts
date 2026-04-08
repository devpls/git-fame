import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { AuthorStats } from '../../../types/author-stats.type.js';
import type { Report } from '../../../types/report.type.js';
import type { Warning } from '../../../types/warning.type.js';
import type { MutableAuthorStats } from './types/mutable-author-stats.type.js';

const createEmptyStats = (name: string, email: string): MutableAuthorStats => ({
  name,
  email,
  linesAlive: 0,
  linesAdded: 0,
  linesDeleted: 0,
  commits: 0,
  filesSet: new Set<string>(),
  firstCommitTime: undefined,
  lastCommitTime: undefined,
});

const finaliseAuthor = (stats: MutableAuthorStats): AuthorStats => {
  const firstTimeSeconds = stats.firstCommitTime ?? 0;
  const lastTimeSeconds = stats.lastCommitTime ?? 0;
  return {
    name: stats.name,
    email: stats.email,
    linesAlive: stats.linesAlive,
    linesAdded: stats.linesAdded,
    linesDeleted: stats.linesDeleted,
    commits: stats.commits,
    files: stats.filesSet.size,
    firstCommit: new Date(firstTimeSeconds * 1000),
    lastCommit: new Date(lastTimeSeconds * 1000),
  };
};

export class Aggregator {
  private readonly authors = new Map<string, MutableAuthorStats>();
  private readonly warnings: Warning[] = [];

  private getOrCreate(name: string, email: string): MutableAuthorStats {
    const existing = this.authors.get(email);
    if (existing !== undefined) {
      existing.name = name;
      return existing;
    }
    const fresh = createEmptyStats(name, email);
    this.authors.set(email, fresh);
    return fresh;
  }

  recordCommit(commit: LogCommit): void {
    const stats = this.getOrCreate(commit.authorName, commit.authorMail);
    stats.commits += 1;

    for (const file of commit.files) {
      stats.linesAdded += file.added;
      stats.linesDeleted += file.deleted;
      stats.filesSet.add(file.path);
    }

    if (stats.firstCommitTime === undefined || commit.authorTime < stats.firstCommitTime) {
      stats.firstCommitTime = commit.authorTime;
    }
    if (stats.lastCommitTime === undefined || commit.authorTime > stats.lastCommitTime) {
      stats.lastCommitTime = commit.authorTime;
    }
  }

  recordBlameLine(line: BlameLine): void {
    const stats = this.getOrCreate(line.authorName, line.authorMail);
    stats.linesAlive += 1;
  }

  recordWarning(warning: Warning): void {
    this.warnings.push(warning);
  }

  build(meta: Report['meta'], repoBase: Report['repo']): Report {
    const authors = Array.from(this.authors.values()).map(finaliseAuthor);

    const totals = authors.reduce(
      (acc, author) => ({
        lines: acc.lines + author.linesAlive,
        commits: acc.commits + author.commits,
        files: acc.files + author.files,
      }),
      { lines: 0, commits: 0, files: 0 },
    );

    return {
      meta,
      repo: {
        ...repoBase,
        totals,
      },
      authors,
      warnings: this.warnings.slice(),
    };
  }

  /**
   * Test-only accessor. Do not call from production code.
   */
  getStatsForTesting(): ReadonlyMap<string, MutableAuthorStats> {
    return this.authors;
  }

  /**
   * Test-only accessor. Do not call from production code.
   */
  getWarningsForTesting(): readonly Warning[] {
    return this.warnings;
  }
}
