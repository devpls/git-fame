import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderSummaryBreakdownMarkdown = (entries: BreakdownEntry[]): string => {
  const header = '| Group | Lines Alive | Files |';
  const separator = '| --- | --- | --- |';
  const rows = entries.map((e) => `| ${e.group} | ${String(e.linesAlive)} | ${String(e.files)} |`);
  return [header, separator, ...rows].join('\n');
};
