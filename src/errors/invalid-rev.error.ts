import { NodeFameError } from './node-fame.error.js';

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
