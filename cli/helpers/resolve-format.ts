import { extname } from 'node:path';

export type FormatSource = 'flag' | 'extension' | 'config' | 'default';

export interface ResolvedFormat {
  format: string;
  source: FormatSource;
}

const EXTENSION_MAP: Record<string, string> = {
  '.json': 'json',
  '.csv': 'csv',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'table',
};

export const resolveFormat = (
  flagFormat: string | undefined,
  outputPath: string | undefined,
  configFormat: string | undefined,
): ResolvedFormat => {
  if (flagFormat !== undefined) {
    return { format: flagFormat, source: 'flag' };
  }

  if (outputPath !== undefined) {
    const ext = extname(outputPath).toLowerCase();
    if (ext !== '') {
      const mapped = EXTENSION_MAP[ext];
      if (mapped !== undefined) {
        return { format: mapped, source: 'extension' };
      }
      throw new Error(`cannot infer format from extension "${ext}"; use --format`);
    }
  }

  if (configFormat !== undefined) {
    return { format: configFormat, source: 'config' };
  }

  return { format: 'table', source: 'default' };
};
