import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
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

export class Aggregator {
  private readonly authors = new Map<string, MutableAuthorStats>();

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

  /**
   * Test-only accessor. Do not call from production code.
   */
  getStatsForTesting(): ReadonlyMap<string, MutableAuthorStats> {
    return this.authors;
  }
}
