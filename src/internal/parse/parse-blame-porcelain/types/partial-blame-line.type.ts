import type { PartialBy } from '../../../types/partial-by.type.js';
import type { BlameLine } from './blame-line.type.js';

export type PartialBlameLine = PartialBy<
  Omit<BlameLine, 'line'>,
  'authorName' | 'authorMail' | 'authorTime'
>;
