import picomatch from 'picomatch';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { matchBuiltInPatterns } from './helpers/match-built-in-patterns.js';

const checkGitattributes = (relPath: string, attrs: GitattributesMap): boolean | null => {
  for (const [pattern, attrValues] of attrs) {
    const matchBase = !pattern.includes('/');
    const isMatch = picomatch(pattern, { dot: true, matchBase });
    if (!isMatch(relPath)) {
      continue;
    }
    if (attrValues['linguist-generated'] === false) {
      return false;
    }
    if (attrValues['linguist-vendored'] === false) {
      return false;
    }
    if (attrValues['linguist-generated'] === true || attrValues['linguist-vendored'] === true) {
      return true;
    }
  }
  return null;
};

export const isGenerated = (relPath: string, attrs: GitattributesMap): boolean => {
  const explicit = checkGitattributes(relPath, attrs);
  if (explicit !== null) {
    return explicit;
  }
  return matchBuiltInPatterns(relPath);
};
