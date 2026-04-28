export const mergeAuthorBreakdown = (
  existing: Record<string, number> | undefined,
  incoming: Record<string, number>,
): Record<string, number> => {
  const base = existing ?? {};
  const merged: Record<string, number> = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    merged[key] = (merged[key] ?? 0) + val;
  }
  return merged;
};
