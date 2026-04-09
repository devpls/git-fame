import type { BlameLine } from '../types/blame-line.type.js';
import type { PartialBlameLine } from '../types/partial-blame-line.type.js';

export const finaliseContentLine = (state: PartialBlameLine | null, raw: string): BlameLine => {
  if (
    state?.authorName === undefined ||
    state.authorMail === undefined ||
    state.authorTime === undefined
  ) {
    throw new Error('parseBlamePorcelain: content line before complete header block');
  }
  return {
    sha: state.sha,
    authorName: state.authorName,
    authorMail: state.authorMail,
    authorTime: state.authorTime,
    line: raw.slice(1),
    isBoundary: state.isBoundary,
  };
};
