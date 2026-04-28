import cliProgress from 'cli-progress';
import type { ProgressEvent } from '../../src/types/progress-event.type.js';

export const wireProgress = (
  options: { onProgress?: (event: ProgressEvent) => void },
  isTTY: boolean | undefined,
): void => {
  if (!isTTY) {
    return;
  }

  let bar: cliProgress.SingleBar | undefined;

  let repoName = '';

  options.onProgress = (event: ProgressEvent): void => {
    if (event.type === 'phase' && event.phase === 'discover') {
      repoName = event.path.split('/').pop() ?? event.path;
    }
    if (event.type === 'blame' && bar === undefined) {
      bar = new cliProgress.SingleBar(
        {
          format: `${repoName} [{bar}] {value}/{total} files`,
          stream: process.stderr,
        },
        cliProgress.Presets.shades_classic,
      );
      bar.start(event.total, 0);
    }
    if (event.type === 'blame' && bar !== undefined) {
      bar.update(event.done);
    }
    if (event.type === 'phase' && event.phase === 'aggregate' && bar !== undefined) {
      bar.stop();
      bar = undefined;
    }
  };
};
