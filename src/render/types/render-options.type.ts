export type SortableColumn =
  | 'linesAlive'
  | 'linesAdded'
  | 'linesDeleted'
  | 'commits'
  | 'files'
  | 'lastCommit';

export interface RenderOptions {
  sort?: {
    by: SortableColumn;
    order?: 'asc' | 'desc';
  };
  limit?: number;
}
