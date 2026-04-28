import Table from 'cli-table3';
import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderSummaryBreakdownTable = (entries: BreakdownEntry[]): string => {
  const table = new Table({
    head: ['Group', 'Lines Alive', 'Files'],
  });

  for (const entry of entries) {
    table.push([entry.group, String(entry.linesAlive), String(entry.files)]);
  }

  return table.toString();
};
