import { Command, Option } from '@commander-js/extra-typings';
import { pathValidator, gitValidator, regexValidator, gitBranchValidator } from './validators';
export const getArguments = () => {
  const program = new Command()
    .version('0.0.1')
    .addOption(
      new Option('-p, --path <path>', 'Path to the git repository')
        .default('./')
        .argParser(pathValidator)
        .argParser(gitValidator),
    )
    .addOption(
      new Option('-f, --filter <filter>', 'Regex to filter files to analyze')
        .default('.*')
        .argParser(regexValidator),
    )
    .addOption(
      new Option('-b, --branch <branch>', 'Branch or tag [default: HEAD] up to which to check')
        .default('HEAD')
        .argParser(gitValidator)
        .argParser(gitBranchValidator),
    )
    .parse(process.argv);

  return program.opts();
};
