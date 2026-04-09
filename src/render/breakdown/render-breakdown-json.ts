import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownJson = (entries: BreakdownEntry[]): string =>
  JSON.stringify({ breakdown: entries }, null, 2);
