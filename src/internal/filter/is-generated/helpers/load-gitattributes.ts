import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGitattributesLine, type ParsedGitattributes } from './parse-gitattributes-line.js';

export type GitattributesMap = Map<string, ParsedGitattributes['attrs']>;

export const loadGitattributes = (repoRoot: string): GitattributesMap => {
  const path = join(repoRoot, '.gitattributes');
  if (!existsSync(path)) {
    return new Map();
  }

  const content = readFileSync(path, 'utf8');
  const map: GitattributesMap = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseGitattributesLine(rawLine);
    if (parsed === null) {
      continue;
    }
    map.set(parsed.pattern, parsed.attrs);
  }

  return map;
};
