import type { PartialBlameLine } from '../types/partial-blame-line.type.js';
import { stripAngleBrackets } from './strip-angle-brackets.js';

export const applyMetadataLine = (state: PartialBlameLine, raw: string): void => {
  if (raw.startsWith('author ')) {
    state.authorName = raw.slice('author '.length);
    return;
  }
  if (raw.startsWith('author-mail ')) {
    state.authorMail = stripAngleBrackets(raw.slice('author-mail '.length));
    return;
  }
  if (raw.startsWith('author-time ')) {
    state.authorTime = Number(raw.slice('author-time '.length));
    return;
  }
  if (raw === 'boundary') {
    state.isBoundary = true;
  }
  // committer-*, author-tz, summary, filename, previous are intentionally ignored.
};
