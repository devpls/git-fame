export type Warning =
  | { code: 'UNINIT_SUBMODULE'; path: string; message: string }
  | { code: 'SUBMODULE_BROKEN'; path: string; message: string }
  | { code: 'BLAME_FAILED'; file: string; error: string; message: string }
  | { code: 'FILE_SKIPPED_BINARY'; file: string; message: string }
  | { code: 'FILE_SKIPPED_GENERATED'; file: string; message: string }
  | { code: 'FILE_SKIPPED_MINIFIED'; file: string; message: string }
  | { code: 'INVALID_UTF8'; file: string; message: string }
  | { code: 'LARGE_FILE'; file: string; bytes: number; message: string }
  | { code: 'MANY_LARGE_FILES'; count: number; message: string }
  | { code: 'MAILMAP_PARSE'; line: number; message: string }
  | { code: 'ALL_FILES_FILTERED'; message: string };
