import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { Report } from '../../types/report.type.js';

export const writeCache = (filePath: string, report: Report): void => {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp.${randomUUID()}`;
  writeFileSync(tmpPath, JSON.stringify(report), 'utf8');
  renameSync(tmpPath, filePath);
};
