import { resolveRev } from './resolve-rev.js';

export interface Range {
  from: string;
  to: string;
}

export interface ResolvedRange {
  fromSha: string;
  toSha: string;
}

export const resolveRange = async (cwd: string, range: Range): Promise<ResolvedRange> => {
  const [fromSha, toSha] = await Promise.all([
    resolveRev(cwd, range.from),
    resolveRev(cwd, range.to),
  ]);
  return { fromSha, toSha };
};
