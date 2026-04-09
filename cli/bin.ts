#!/usr/bin/env node
import cliProgress from 'cli-progress';
import { CommanderError } from 'commander';
import { analyze } from '../src/analyze.js';
import { render } from '../src/render/index.js';
import type { RenderFormat } from '../src/render/index.js';
import type { ProgressEvent } from '../src/types/progress-event.type.js';
import { parseFlags } from './parse-flags.js';

const main = async (): Promise<void> => {
  const { options, format, renderOptions } = parseFlags(process.argv);

  // Wire progress bar only on TTY
  let bar: cliProgress.SingleBar | undefined;
  if (process.stdout.isTTY) {
    options.onProgress = (event: ProgressEvent): void => {
      if (event.type === 'blame' && bar === undefined) {
        bar = new cliProgress.SingleBar(
          { format: 'Analyzing [{bar}] {value}/{total} files' },
          cliProgress.Presets.shades_classic,
        );
        bar.start(event.total, 0);
      }
      if (event.type === 'blame' && bar !== undefined) {
        bar.update(event.done);
      }
      if (event.type === 'phase' && event.phase === 'aggregate' && bar !== undefined) {
        bar.stop();
      }
    };
  }

  const report = await analyze(options);
  const output = render(report, format as RenderFormat, renderOptions);
  process.stdout.write(output + '\n');
};

main().catch((err: unknown) => {
  if (err instanceof CommanderError) {
    process.exit(err.exitCode);
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
