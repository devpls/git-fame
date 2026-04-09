#!/usr/bin/env node
import cliProgress from 'cli-progress';
import { analyze } from '../src/analyze.js';
import { analyzeMany } from '../src/analyze-many.js';
import { render, renderBreakdown } from '../src/render/index.js';
import type { RenderFormat } from '../src/render/index.js';
import type { AnalyzeManyOptions } from '../src/types/analyze-many-options.type.js';
import type { ProgressEvent } from '../src/types/progress-event.type.js';
import { parseFlags } from './parse-flags.js';

const main = async (): Promise<void> => {
  const { options, format, renderOptions, recursive, splitSubmodules, perAuthor } = parseFlags(
    process.argv,
  );
  const needsMany = recursive || splitSubmodules;

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

  if (needsMany) {
    const manyOptions: AnalyzeManyOptions = { ...options, recursive, splitSubmodules };
    const reports = await analyzeMany(manyOptions);
    for (const report of reports) {
      process.stdout.write(`\n=== ${report.repo.path} ===\n`);
      process.stdout.write(render(report, format as RenderFormat, renderOptions) + '\n');
    }
  } else {
    const report = await analyze(options);
    // progress bar already wired via onProgress
    const output = render(report, format as RenderFormat, renderOptions);
    process.stdout.write(output + '\n');

    if (!perAuthor) {
      const breakdownOutput = renderBreakdown(report, format as RenderFormat);
      if (breakdownOutput !== undefined) {
        process.stdout.write('\n' + breakdownOutput + '\n');
      }
    }
  }
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
