import { openSync, readSync, closeSync } from 'node:fs';

const PROBE_BYTES = 8192;

export const isBinary = (absPath: string): boolean => {
  const fd = openSync(absPath, 'r');
  try {
    const buffer = Buffer.alloc(PROBE_BYTES);
    const bytesRead = readSync(fd, buffer, 0, PROBE_BYTES, 0);
    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0x00) {
        return true;
      }
    }
    return false;
  } finally {
    closeSync(fd);
  }
};
