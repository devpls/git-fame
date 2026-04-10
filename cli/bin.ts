#!/usr/bin/env node
import cliProgress from 'cli-progress';
import { analyze } from '../src/analyze.js';
import { analyzeMany } from '../src/analyze-many.js';
import { render, renderBreakdown } from '../src/render/index.js';
import type { RenderFormat } from '../src/render/index.js';
import type { AnalyzeManyOptions } from '../src/types/analyze-many-options.type.js';
import type { ProgressEvent } from '../src/types/progress-event.type.js';
import { parseFlags } from './parse-flags.js';

const wireProgress = (
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
        { format: `${repoName} [{bar}] {value}/{total} files` },
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

const main = async (): Promise<void> => {
  const { options, format, renderOptions, recursive, splitSubmodules, perAuthor } = parseFlags(
    process.argv,
  );
  const needsMany = recursive || splitSubmodules;

  wireProgress(options, process.stdout.isTTY);

  if (needsMany) {
    const manyOptions: AnalyzeManyOptions = { ...options, recursive, splitSubmodules };
    const reports = await analyzeMany(manyOptions);
    for (const report of reports) {
      process.stdout.write(`\n=== ${report.repo.path} ===\n`);
      process.stdout.write(render(report, format as RenderFormat, renderOptions) + '\n');

      if (!perAuthor) {
        const breakdownOutput = renderBreakdown(report, format as RenderFormat);
        if (breakdownOutput !== undefined) {
          process.stdout.write('\n' + breakdownOutput + '\n');
        }
      }
    }
  } else {
    const report = await analyze(options);
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
