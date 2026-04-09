import { openSync, readSync, closeSync } from 'node:fs';

const PROBE_BYTES = 65536;
const AVG_LINE_LENGTH_THRESHOLD = 500;

export const isMinified = (absPath: string): boolean => {
  const fd = openSync(absPath, 'r');
  try {
    const buffer = Buffer.alloc(PROBE_BYTES);
    const bytesRead = readSync(fd, buffer, 0, PROBE_BYTES, 0);
    if (bytesRead === 0) {
      return false;
    }

    const text = buffer.toString('utf8', 0, bytesRead);
    const lines = text.split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
      return false;
    }

    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    const avgLength = totalChars / lines.length;
    return avgLength > AVG_LINE_LENGTH_THRESHOLD;
  } finally {
    closeSync(fd);
  }
};
