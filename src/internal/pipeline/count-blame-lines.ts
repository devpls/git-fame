import type { Aggregator } from '../identity/aggregator/index.js';

const HEADER_REGEX = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/;

const stripAngleBrackets = (s: string): string =>
  s.startsWith('<') && s.endsWith('>') ? s.slice(1, -1) : s;

export const countBlameLines = (
  output: string,
  aggregator: Aggregator,
  groupKey?: string,
): void => {
  if (output.length === 0) {
    return;
  }

  const cache = new Map<string, { name: string; mail: string }>();
  let currentSha = '';
  let currentName = '';
  let currentMail = '';
  let hasCached = false;

  for (const raw of output.split('\n')) {
    if (raw.length === 0) {
      continue;
    }

    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (line.startsWith('\t')) {
      aggregator.recordBlameAuthor(currentName, currentMail);
      if (groupKey !== undefined) {
        aggregator.recordBlameGroup(currentName, currentMail, groupKey);
      }
      if (!hasCached && currentSha !== '') {
        cache.set(currentSha, { name: currentName, mail: currentMail });
      }
      hasCached = false;
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(line);
    if (headerMatch !== null) {
      currentSha = headerMatch[1] ?? '';
      const cached = cache.get(currentSha);
      if (cached !== undefined) {
        currentName = cached.name;
        currentMail = cached.mail;
        hasCached = true;
      }
      continue;
    }

    if (line.startsWith('author ')) {
      currentName = line.slice(7);
      continue;
    }

    if (line.startsWith('author-mail ')) {
      currentMail = stripAngleBrackets(line.slice(12));
      continue;
    }
  }
};
