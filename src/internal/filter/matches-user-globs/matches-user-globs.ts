import picomatch from 'picomatch';

const makeMatchers = (patterns: readonly string[]): ((path: string) => boolean)[] =>
  patterns.map((p) => picomatch(p, { dot: true, matchBase: !p.includes('/') }));

const matchesAny = (path: string, matchers: ((path: string) => boolean)[]): boolean =>
  matchers.some((m) => m(path));

export const matchesUserGlobs = (
  relPath: string,
  includeGlobs: readonly string[],
  excludeGlobs: readonly string[],
): boolean => {
  if (excludeGlobs.length > 0 && matchesAny(relPath, makeMatchers(excludeGlobs))) {
    return false;
  }

  if (includeGlobs.length > 0) {
    return matchesAny(relPath, makeMatchers(includeGlobs));
  }

  return true;
};
