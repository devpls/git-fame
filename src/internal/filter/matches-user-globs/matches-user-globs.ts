import picomatch from 'picomatch';

export const compileMatchers = (patterns: readonly string[]): ((path: string) => boolean)[] =>
  patterns.map((p) => picomatch(p, { dot: true, matchBase: !p.includes('/') }));

const matchesAny = (path: string, matchers: ((path: string) => boolean)[]): boolean =>
  matchers.some((m) => m(path));

export const matchesUserGlobs = (
  relPath: string,
  includeMatchers: ((path: string) => boolean)[],
  excludeMatchers: ((path: string) => boolean)[],
): boolean => {
  if (excludeMatchers.length > 0 && matchesAny(relPath, excludeMatchers)) {
    return false;
  }

  if (includeMatchers.length > 0) {
    return matchesAny(relPath, includeMatchers);
  }

  return true;
};
