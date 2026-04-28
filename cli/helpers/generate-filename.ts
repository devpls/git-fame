import { basename, relative, resolve } from 'node:path';
import { formatExtension } from './format-extension.js';

const sanitize = (raw: string): string =>
  raw
    .replace(/[\\/]/g, '--')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '--')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const generateFilename = (
  repoPath: string,
  scanRoot: string | undefined,
  timestamp: string,
  format: string,
): string => {
  const ext = formatExtension(format);
  const absRepo = resolve(repoPath);
  let raw: string;
  if (scanRoot === undefined) {
    raw = basename(absRepo);
  } else {
    const absScan = resolve(scanRoot);
    const rel = relative(absScan, absRepo);
    raw = rel === '' || rel === '.' ? basename(absScan) : rel;
  }
  const name = sanitize(raw);
  return `git-fame-report_${name}_${timestamp}${ext}`;
};
