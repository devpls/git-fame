export const formatTimestamp = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(date.getUTCFullYear())}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
};
