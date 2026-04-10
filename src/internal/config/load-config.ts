import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface NodeFameConfig {
  format?: string;
  sort?: string;
  limit?: number;
  rev?: string;
  from?: string;
  to?: string;
  since?: string;
  until?: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  includeWhitespace?: boolean;
  includeBinary?: boolean;
  includeGenerated?: boolean;
  excludeMinified?: boolean;
  followRenames?: boolean;
  mailmap?: boolean;
  cache?: boolean;
  concurrency?: number;
  submodules?: boolean;
  splitSubmodules?: boolean;
  recursive?: boolean;
}

const KNOWN_KEYS = new Set<string>([
  'format',
  'sort',
  'limit',
  'rev',
  'from',
  'to',
  'since',
  'until',
  'includeGlobs',
  'excludeGlobs',
  'includeWhitespace',
  'includeBinary',
  'includeGenerated',
  'excludeMinified',
  'followRenames',
  'mailmap',
  'cache',
  'concurrency',
  'submodules',
  'splitSubmodules',
  'recursive',
]);

export const loadConfig = (repoPath: string): NodeFameConfig => {
  const configPath = join(repoPath, '.gitfamerc');

  if (!existsSync(configPath)) {
    return {};
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse .gitfamerc: ${message}`);
  }

  const config: NodeFameConfig = {};

  for (const key of Object.keys(raw)) {
    if (KNOWN_KEYS.has(key)) {
      (config as Record<string, unknown>)[key] = raw[key];
    }
  }

  return config;
};
