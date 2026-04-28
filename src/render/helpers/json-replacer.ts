export const jsonReplacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  return value;
};
