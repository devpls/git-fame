import { createInterface } from 'node:readline';
import type { PartialBy } from '../types/partial-by.type.js';

export interface BlameLine {
  sha: string;
  authorName: string;
  authorMail: string;
  authorTime: number;
  line: string;
  isBoundary: boolean;
}

type PartialBlameLine = PartialBy<
  Omit<BlameLine, 'line'>,
  'authorName' | 'authorMail' | 'authorTime'
>;

const HEADER_REGEX = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/;

const stripAngleBrackets = (mail: string): string => {
  if (mail.startsWith('<') && mail.endsWith('>')) {
    return mail.slice(1, -1);
  }
  return mail;
};

export async function* parseBlamePorcelain(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<BlameLine> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let state: PartialBlameLine | null = null;

  for await (const raw of rl) {
    if (raw.startsWith('\t')) {
      if (
        state?.authorName === undefined ||
        state.authorMail === undefined ||
        state.authorTime === undefined
      ) {
        throw new Error('parseBlamePorcelain: content line before complete header block');
      }
      yield {
        sha: state.sha,
        authorName: state.authorName,
        authorMail: state.authorMail,
        authorTime: state.authorTime,
        line: raw.slice(1),
        isBoundary: state.isBoundary,
      };
      state = null;
      continue;
    }

    const headerMatch = HEADER_REGEX.exec(raw);
    if (headerMatch !== null) {
      if (state !== null) {
        throw new Error('parseBlamePorcelain: header line arrived before previous entry finished');
      }
      const sha = headerMatch[1] ?? '';
      state = { sha, isBoundary: false };
      continue;
    }

    if (state === null) {
      throw new Error(`parseBlamePorcelain: unexpected line outside of a block: ${raw}`);
    }

    if (raw.startsWith('author ')) {
      state.authorName = raw.slice('author '.length);
    } else if (raw.startsWith('author-mail ')) {
      state.authorMail = stripAngleBrackets(raw.slice('author-mail '.length));
    } else if (raw.startsWith('author-time ')) {
      state.authorTime = Number(raw.slice('author-time '.length));
    } else if (raw === 'boundary') {
      state.isBoundary = true;
    }
    // committer-*, author-tz, summary, filename, previous are intentionally ignored.
  }

  if (state !== null) {
    throw new Error('parseBlamePorcelain: unexpected end of stream in the middle of a block');
  }
}
