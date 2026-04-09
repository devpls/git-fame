import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMailmap } from './load-mailmap.js';

describe('loadMailmap', () => {
  const created: string[] = [];

  const makeDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), `mailmap-test-${randomUUID()}-`));
    created.push(dir);
    return dir;
  };

  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('returns identity canonicalizer when no .mailmap file exists', () => {
    const dir = makeDir();
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('Alice', 'alice@old')).toEqual({
      name: 'Alice',
      email: 'alice@old',
    });
  });

  it('maps old email to new email via email-only entry', () => {
    const dir = makeDir();
    writeFileSync(join(dir, '.mailmap'), 'Alice Smith <alice@new> <alice@old>\n', 'utf8');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('alice', 'alice@old')).toEqual({
      name: 'Alice Smith',
      email: 'alice@new',
    });
  });

  it('returns input unchanged when email does not match any entry', () => {
    const dir = makeDir();
    writeFileSync(join(dir, '.mailmap'), 'Alice Smith <alice@new> <alice@old>\n', 'utf8');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('Bob', 'bob@example.com')).toEqual({
      name: 'Bob',
      email: 'bob@example.com',
    });
  });

  it('specific entry (name + email) takes priority over email-only entry', () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, '.mailmap'),
      [
        'Alice Smith <alice@new> <alice@old>',
        'Alice Specific <alice@specific> alice <alice@old>',
      ].join('\n') + '\n',
      'utf8',
    );
    const mailmap = loadMailmap(dir);
    // When commit name is "alice", specific entry wins
    expect(mailmap.canonicalize('alice', 'alice@old')).toEqual({
      name: 'Alice Specific',
      email: 'alice@specific',
    });
    // When commit name is something else, falls back to email-only
    expect(mailmap.canonicalize('othername', 'alice@old')).toEqual({
      name: 'Alice Smith',
      email: 'alice@new',
    });
  });

  it('corrects name only via form 1 entry', () => {
    const dir = makeDir();
    writeFileSync(join(dir, '.mailmap'), 'Alice Smith <alice@example.com>\n', 'utf8');
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('alice', 'alice@example.com')).toEqual({
      name: 'Alice Smith',
      email: 'alice@example.com',
    });
  });

  it('skips comment and blank lines in .mailmap', () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, '.mailmap'),
      ['# This is a comment', '', 'Alice Smith <alice@new> <alice@old>', '# another comment'].join(
        '\n',
      ) + '\n',
      'utf8',
    );
    const mailmap = loadMailmap(dir);
    expect(mailmap.canonicalize('alice', 'alice@old')).toEqual({
      name: 'Alice Smith',
      email: 'alice@new',
    });
    expect(mailmap.canonicalize('alice', 'alice@unrelated')).toEqual({
      name: 'alice',
      email: 'alice@unrelated',
    });
  });
});
