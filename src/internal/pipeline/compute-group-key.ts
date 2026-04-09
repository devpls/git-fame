import { extname } from 'node:path';

interface GroupByConfig {
  type: 'extension' | 'directory';
  depth: number;
}

export const computeGroupKey = (filePath: string, groupBy: GroupByConfig): string => {
  if (groupBy.type === 'extension') {
    const ext = extname(filePath);
    return ext === '' ? '(no ext)' : ext;
  }

  const segments = filePath.split('/');
  if (segments.length <= 1) {
    return '(root)';
  }

  const dirSegments = segments.slice(0, -1);
  const taken = dirSegments.slice(0, groupBy.depth);
  return taken.length === 0 ? '(root)' : taken.join('/');
};
