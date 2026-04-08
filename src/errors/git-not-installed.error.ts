import { NodeFameError } from './node-fame.error.js';

export class GitNotInstalledError extends NodeFameError {
  constructor(message = 'git executable not found in PATH') {
    super(message, 'git_not_installed');
    this.name = 'GitNotInstalledError';
  }
}
