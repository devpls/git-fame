import { readFileSync } from 'node:fs';
import type { Report } from '../../types/report.type.js';

export const readCache = (filePath: string): Report | undefined => {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const meta = parsed.meta as Record<string, unknown>;
    meta.generatedAt = new Date(meta.generatedAt as string);

    const authors = parsed.authors as Record<string, unknown>[];
    for (const author of authors) {
      author.firstCommit = new Date(author.firstCommit as string);
      author.lastCommit = new Date(author.lastCommit as string);
    }

    return parsed as unknown as Report;
  } catch {
    return undefined;
  }
};
