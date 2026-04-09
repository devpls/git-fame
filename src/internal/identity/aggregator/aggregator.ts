import type { BlameLine } from '../../parse/parse-blame-porcelain/index.js';
import type { LogCommit } from '../../parse/parse-log-numstat/index.js';
import type { Mailmap } from '../mailmap/index.js';
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

const identityMailmap: Mailmap = {
  canonicalize(name: string, email: string): { name: string; email: string } {
    return { name, email };
  },
};

export class Aggregator {
  private readonly authors = new Map<string, MutableAuthorStats>();
  private readonly warnings: Warning[] = [];
  private readonly mailmap: Mailmap;

  constructor(mailmap?: Mailmap) {
    this.mailmap = mailmap ?? identityMailmap;
  }

  private getOrCreate(name: string, email: string): MutableAuthorStats {
    const canonical = this.mailmap.canonicalize(name, email);
    const existing = this.authors.get(canonical.email);
    if (existing !== undefined) {
      existing.name = canonical.name;
      return existing;
    }
    const fresh = createEmptyStats(canonical.name, canonical.email);
    this.authors.set(canonical.email, fresh);
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

  recordBlameAuthor(name: string, mail: string): void {
    const stats = this.getOrCreate(name, mail);
    stats.linesAlive += 1;
  }

  recordWarning(warning: Warning): void {
    this.warnings.push(warning);
  }

  mergeAuthorStats(author: AuthorStats): void {
    const stats = this.getOrCreate(author.name, author.email);
    stats.linesAlive += author.linesAlive;
    stats.linesAdded += author.linesAdded;
    stats.linesDeleted += author.linesDeleted;
    stats.commits += author.commits;
    // files: generate unique placeholder keys to approximate the count
    for (let i = 0; i < author.files; i += 1) {
      stats.filesSet.add(`__sub__${author.email}__${String(stats.filesSet.size)}`);
    }
    const firstSec = Math.floor(author.firstCommit.getTime() / 1000);
    const lastSec = Math.floor(author.lastCommit.getTime() / 1000);
    if (stats.firstCommitTime === undefined || firstSec < stats.firstCommitTime) {
      stats.firstCommitTime = firstSec;
    }
    if (stats.lastCommitTime === undefined || lastSec > stats.lastCommitTime) {
      stats.lastCommitTime = lastSec;
    }
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
