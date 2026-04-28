import { formatExtension } from './format-extension.js';

export const generateSummaryFilename = (timestamp: string, format: string): string => {
  const ext = formatExtension(format);
  return `git-fame-report_summary_${timestamp}${ext}`;
};
