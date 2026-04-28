#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';
import { analyzeMany } from '../src/analyze-many.js';
import type { RenderFormat } from '../src/render/index.js';
import type { AnalyzeManyOptions } from '../src/types/analyze-many-options.type.js';
import { parseFlags } from './parse-flags.js';
import { detectOutputMode } from './helpers/detect-output-mode.js';
import { formatTimestamp } from './helpers/format-timestamp.js';
import { generateFilename } from './helpers/generate-filename.js';
import { renderSingleReport } from './helpers/render-single-report.js';
import { wireProgress } from './helpers/wire-progress.js';
import { writeManyToDirectory } from './helpers/write-many-to-directory.js';
import { writeManyToFile } from './helpers/write-many-to-file.js';
import { writeManyToStdout } from './helpers/write-many-to-stdout.js';

const main = async (): Promise<void> => {
  const {
    options,
    format,
    formatSource,
    renderOptions,
    recursive,
    splitSubmodules,
    perAuthor,
    output,
    summary,
  } = parseFlags(process.argv);

  const outputMode = detectOutputMode(output);
  const now = new Date();
  const timestamp = formatTimestamp(now);

  if (outputMode === 'directory' && (formatSource === 'extension' || formatSource === 'default')) {
    process.stderr.write(
      'git-fame: directory output requires --format or a format in .gitfamerc\n',
    );
    process.exit(1);
  }

  wireProgress(options, process.stderr.isTTY);

  const needsMany = recursive || splitSubmodules;
  const renderFormat = format as RenderFormat;

  if (needsMany) {
    const manyOptions: AnalyzeManyOptions = { ...options, recursive, splitSubmodules };
    const reports = await analyzeMany(manyOptions);

    if (reports.length === 0) {
      process.stderr.write('git-fame: no repositories found\n');
      process.exit(1);
    }

    if (outputMode === 'stdout') {
      writeManyToStdout(reports, format, renderFormat, renderOptions, perAuthor, summary, now);
      return;
    }

    if (outputMode === 'file' && output !== undefined) {
      writeManyToFile(
        reports,
        output,
        format,
        renderFormat,
        renderOptions,
        perAuthor,
        summary,
        now,
      );
      return;
    }

    if (output !== undefined) {
      writeManyToDirectory(
        reports,
        output,
        format,
        renderFormat,
        renderOptions,
        perAuthor,
        options.path,
        summary,
        timestamp,
      );
    }

    return;
  }

  // single repo
  const report = await analyze(options);
  const content = renderSingleReport(report, renderFormat, renderOptions, perAuthor);

  if (outputMode === 'stdout') {
    process.stdout.write(content + '\n');
    return;
  }

  if (outputMode === 'file' && output !== undefined) {
    writeFileSync(output, content + '\n', 'utf8');
    return;
  }

  // directory mode for single repo
  if (output !== undefined) {
    mkdirSync(output, { recursive: true });
    const filename = generateFilename(report.repo.path, undefined, timestamp, format);
    writeFileSync(join(output, filename), content + '\n', 'utf8');
  }
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`git-fame: ${message}\n`);
  process.exit(1);
});
