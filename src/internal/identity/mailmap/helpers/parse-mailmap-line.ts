import type { MailmapEntry } from '../types/mailmap.type.js';

const EMAIL_PATTERN = /<([^>]+)>/g;

export const parseMailmapLine = (line: string): MailmapEntry | undefined => {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) {
    return undefined;
  }

  const emails: string[] = [];
  const sentinel = '\0';

  // Replace each <email> block with the sentinel and collect emails in order
  const withSentinels = trimmed.replace(EMAIL_PATTERN, (_match, email: string) => {
    emails.push(email);
    return sentinel;
  });

  // No email found — not a valid mailmap line
  if (emails.length === 0) {
    return undefined;
  }

  // Split by sentinel to get text segments (names between email brackets)
  const segments = withSentinels.split(sentinel).map((s) => s.trim());

  if (emails.length === 1) {
    // Form 1: "Proper Name <commit-email>"
    // proper name corrected for that commit email; commit email stays the same
    const properName = segments[0] ?? '';
    const commitEmail = emails[0] ?? '';
    return {
      proper: { name: properName, email: commitEmail },
      commit: { name: undefined, email: commitEmail },
    };
  }

  // Two emails: forms 2, 3, 4
  const properEmail = emails[0] ?? '';
  const commitEmail = emails[1] ?? '';

  // Text before the first email
  const beforeFirst = segments[0] ?? '';
  // Text between the two emails
  const between = segments[1] ?? '';

  if (beforeFirst === '' && between === '') {
    // Form 3: "<proper-email> <commit-email>" — email correction only
    return {
      proper: { name: '', email: properEmail },
      commit: { name: undefined, email: commitEmail },
    };
  }

  if (beforeFirst !== '' && between === '') {
    // Form 2: "Proper Name <proper-email> <commit-email>"
    return {
      proper: { name: beforeFirst, email: properEmail },
      commit: { name: undefined, email: commitEmail },
    };
  }

  // Form 4: "Proper Name <proper-email> Commit Name <commit-email>"
  return {
    proper: { name: beforeFirst, email: properEmail },
    commit: { name: between, email: commitEmail },
  };
};
