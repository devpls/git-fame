#!/usr/bin/env node
import { CommanderError } from 'commander';
import { analyze } from '../src/analyze.js';
import { render } from '../src/render/index.js';
import type { RenderFormat } from '../src/render/index.js';
import { parseFlags } from './parse-flags.js';

const main = async (): Promise<void> => {
  const { options, format, renderOptions } = parseFlags(process.argv);
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
