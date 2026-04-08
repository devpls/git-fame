export class NodeFameError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'NodeFameError';
    this.code = code;
  }
}

export class NotAGitRepoError extends NodeFameError {
  readonly path: string;

  constructor(path: string) {
    super(`${path} is not a git repository`, 'not_a_git_repo');
    this.name = 'NotAGitRepoError';
    this.path = path;
  }
}

export class GitNotInstalledError extends NodeFameError {
  constructor(message = 'git executable not found in PATH') {
    super(message, 'git_not_installed');
    this.name = 'GitNotInstalledError';
  }
}

export class InvalidRevError extends NodeFameError {
  readonly rev: string;
  readonly cwd: string;

  constructor(rev: string, cwd: string) {
    super(`rev '${rev}' does not exist in ${cwd}`, 'invalid_rev');
    this.name = 'InvalidRevError';
    this.rev = rev;
    this.cwd = cwd;
  }
}

export class ConflictingOptionsError extends NodeFameError {
  readonly details: string;

  constructor(details: string) {
    super(details, 'conflicting_options');
    this.name = 'ConflictingOptionsError';
    this.details = details;
  }
}

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

export class AbortError extends NodeFameError {
  constructor(message = 'analysis aborted') {
    super(message, 'aborted');
    this.name = 'AbortError';
  }
}
