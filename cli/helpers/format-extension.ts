const FORMAT_EXT: Record<string, string> = {
  json: '.json',
  csv: '.csv',
  markdown: '.md',
  table: '.txt',
};

export const formatExtension = (format: string): string => FORMAT_EXT[format] ?? '.txt';
