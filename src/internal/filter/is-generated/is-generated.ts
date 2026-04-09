import picomatch from 'picomatch';
import type { GitattributesMap } from './helpers/load-gitattributes.js';
import { matchBuiltInPatterns } from './helpers/match-built-in-patterns.js';

export interface CompiledAttrRule {
  matcher: (path: string) => boolean;
  generatedExplicit?: boolean;
  vendoredExplicit?: boolean;
}

export const compileGitattributeMatchers = (attrs: GitattributesMap): CompiledAttrRule[] => {
  const rules: CompiledAttrRule[] = [];
  for (const [pattern, attrValues] of attrs) {
    const matchBase = !pattern.includes('/');
    const rule: CompiledAttrRule = {
      matcher: picomatch(pattern, { dot: true, matchBase }),
    };
    if (attrValues['linguist-generated'] !== undefined) {
      rule.generatedExplicit = attrValues['linguist-generated'];
    }
    if (attrValues['linguist-vendored'] !== undefined) {
      rule.vendoredExplicit = attrValues['linguist-vendored'];
    }
    rules.push(rule);
  }
  return rules;
};

export const isGenerated = (relPath: string, compiledRules: CompiledAttrRule[]): boolean => {
  for (const rule of compiledRules) {
    if (!rule.matcher(relPath)) {
      continue;
    }
    if (rule.generatedExplicit === false || rule.vendoredExplicit === false) {
      return false;
    }
    if (rule.generatedExplicit === true || rule.vendoredExplicit === true) {
      return true;
    }
  }
  return matchBuiltInPatterns(relPath);
};
