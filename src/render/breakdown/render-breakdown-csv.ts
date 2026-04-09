import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownCsv = (entries: BreakdownEntry[]): string => {
  const header = 'group,linesAlive,files';
  const rows = entries.map((e) => `${e.group},${String(e.linesAlive)},${String(e.files)}`);
  return [header, ...rows].join('\n');
};
