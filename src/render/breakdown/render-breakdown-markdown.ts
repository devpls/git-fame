import type { BreakdownEntry } from '../../types/breakdown-entry.type.js';

export const renderBreakdownMarkdown = (entries: BreakdownEntry[]): string => {
  const header = '| group | linesAlive | files |';
  const separator = '| --- | --- | --- |';
  const rows = entries.map((e) => `| ${e.group} | ${String(e.linesAlive)} | ${String(e.files)} |`);
  return [header, separator, ...rows].join('\n');
};
