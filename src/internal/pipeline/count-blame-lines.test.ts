import { describe, expect, it } from 'vitest';
import { Aggregator } from '../identity/aggregator/index.js';
import { buildBlameFixture } from '../../../tests/helpers/build-blame-fixture.js';
import { countBlameLines } from './count-blame-lines.js';

describe('countBlameLines', () => {
  it('counts lines per author from porcelain output', () => {
    const fixture = buildBlameFixture([
      {
        sha: 'aaa0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        filename: 'a.txt',
        content: 'line one',
      },
      {
        sha: 'aaa0000000000000000000000000000000000000',
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        filename: 'a.txt',
        content: 'line two',
      },
      {
        sha: 'bbb0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 3,
        groupCount: 1,
        authorName: 'Bob',
        authorMail: 'bob@example.com',
        authorTime: 1704153600,
        summary: 'second',
        filename: 'a.txt',
        content: 'bob line',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);

    const stats = aggregator.getStatsForTesting();
    expect(stats.get('alice@example.com')?.linesAlive).toBe(2);
    expect(stats.get('bob@example.com')?.linesAlive).toBe(1);
  });

  it('returns 0 for empty output', () => {
    const aggregator = new Aggregator();
    countBlameLines('', aggregator);
    expect(aggregator.getStatsForTesting().size).toBe(0);
  });

  it('handles boundary markers', () => {
    const fixture = buildBlameFixture([
      {
        sha: 'ccc0000000000000000000000000000000000000',
        origLine: 1,
        finalLine: 1,
        groupCount: 1,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'first',
        boundary: true,
        filename: 'a.txt',
        content: 'boundary line',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);
    expect(aggregator.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(1);
  });

  it('uses cached author info for subsequent lines from same SHA', () => {
    const sha = '1111111111111111111111111111111111111111';
    const fixture = buildBlameFixture([
      {
        sha,
        origLine: 1,
        finalLine: 1,
        groupCount: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'first',
      },
      {
        sha,
        origLine: 2,
        finalLine: 2,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'second',
      },
      {
        sha,
        origLine: 3,
        finalLine: 3,
        authorName: 'Alice',
        authorMail: 'alice@example.com',
        authorTime: 1704067200,
        summary: 'commit',
        filename: 'a.txt',
        content: 'third',
      },
    ]);

    const aggregator = new Aggregator();
    countBlameLines(fixture, aggregator);
    expect(aggregator.getStatsForTesting().get('alice@example.com')?.linesAlive).toBe(3);
  });
});
