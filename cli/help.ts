export const HELP_TEXT = `Usage: git-fame [options] [path]

Fast, accurate git contribution stats — lines, commits, files per author.

Arguments:
  path                           Repository path (default: current directory)

Options:
  -v, --version                  Output the version number
  --format <format>              Output format: table, json, csv, markdown (default: table)
  --sort <column>                Sort by: linesAlive, linesAdded, linesDeleted, commits, files (default: linesAlive)
  --limit <n>                    Show only top N authors
  --rev <ref>                    Analyze at a specific commit, tag, or branch
  --from <ref>                   Start of commit range (used with --to)
  --to <ref>                     End of commit range (used with --from)
  --since <date>                 Only count log entries after this date
  --until <date>                 Only count log entries before this date
  --include-whitespace           Count whitespace-only changes
  --include-binary               Include binary files
  --include-generated            Include generated/vendored files
  --exclude-minified             Exclude minified files
  --no-follow-renames            Do not follow renames in blame
  --no-mailmap                   Do not apply .mailmap
  --include-globs <a,b,c>        Only analyze matching files (comma-separated)
  --exclude-globs <a,b,c>        Exclude matching files (comma-separated)
  --concurrency <n>              Parallel blame workers (default: auto)
  --no-cache                     Disable result caching
  --bytype                       Group results by file extension
  --bydir <depth>                Group results by directory at given depth
  --per-author                   Show breakdown per author (with --bytype or --bydir)
  --submodules                   Walk into submodules
  --split-submodules             Separate reports per submodule
  --recursive                    Analyze all repos in subdirectories
  -o, --output <path>            Write output to file or directory
  -S, --summary                  Show cross-repo summary (requires --recursive or --split-submodules)
  -h, --help                     Display help
`;
