import picomatch from 'picomatch';
import { BUILT_IN_GENERATED_PATTERNS } from '../data/built-in-patterns.js';

const isMatchAnyBuiltIn = picomatch(BUILT_IN_GENERATED_PATTERNS as string[], {
  dot: true,
  nocase: false,
  basename: false,
});

export const matchBuiltInPatterns = (relPath: string): boolean => isMatchAnyBuiltIn(relPath);
