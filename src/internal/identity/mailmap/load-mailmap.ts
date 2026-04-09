import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMailmapLine } from './helpers/parse-mailmap-line.js';
import type { Mailmap, MailmapEntry } from './types/mailmap.type.js';

const buildSpecificKey = (name: string, email: string): string => `${name}\0${email}`;

const buildMaps = (
  lines: string[],
): {
  specific: Map<string, MailmapEntry>;
  byEmail: Map<string, MailmapEntry>;
} => {
  const specific = new Map<string, MailmapEntry>();
  const byEmail = new Map<string, MailmapEntry>();

  for (const line of lines) {
    const entry = parseMailmapLine(line);
    if (entry === undefined) {
      continue;
    }

    if (entry.commit.name !== undefined) {
      const key = buildSpecificKey(entry.commit.name, entry.commit.email);
      specific.set(key, entry);
    } else {
      byEmail.set(entry.commit.email, entry);
    }
  }

  return { specific, byEmail };
};

const identityMailmap: Mailmap = {
  canonicalize(name: string, email: string): { name: string; email: string } {
    return { name, email };
  },
};

export const loadMailmap = (repoRoot: string): Mailmap => {
  let content: string;
  try {
    content = readFileSync(join(repoRoot, '.mailmap'), 'utf8');
  } catch {
    return identityMailmap;
  }

  const lines = content.split('\n');
  const { specific, byEmail } = buildMaps(lines);

  return {
    canonicalize(name: string, email: string): { name: string; email: string } {
      const specificKey = buildSpecificKey(name, email);
      const specificEntry = specific.get(specificKey);
      if (specificEntry !== undefined) {
        return { name: specificEntry.proper.name, email: specificEntry.proper.email };
      }

      const emailEntry = byEmail.get(email);
      if (emailEntry !== undefined) {
        const resolvedName = emailEntry.proper.name !== '' ? emailEntry.proper.name : name;
        return { name: resolvedName, email: emailEntry.proper.email };
      }

      return { name, email };
    },
  };
};
