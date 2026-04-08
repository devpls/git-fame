import { NodeFameError } from './node-fame.error.js';

export class GitCommandError extends NodeFameError {
  readonly cmd: string;
  readonly cwd: string;
  readonly stderr: string;
  readonly exitCode: number;

  constructor(cmd: string, cwd: string, stderr: string, exitCode: number) {
    const stderrSummary = stderr.trim() || '(no stderr)';
    super(`${cmd} exited ${String(exitCode)}: ${stderrSummary}`, 'git_command_failed');
    this.name = 'GitCommandError';
    this.cmd = cmd;
    this.cwd = cwd;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}
