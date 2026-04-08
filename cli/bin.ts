#!/usr/bin/env node
import { analyze } from '../src/analyze.js';
import { render } from '../src/render/index.js';

const main = async (): Promise<void> => {
  const path = process.argv[2] ?? process.cwd();
  const report = await analyze({ path });
  const output = render(report, 'table');
  process.stdout.write(output + '\n');
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`node-fame: ${message}\n`);
  process.exit(1);
});
