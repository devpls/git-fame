import { NodeFameError } from './node-fame.error.js';

export class ConflictingOptionsError extends NodeFameError {
  readonly details: string;

  constructor(details: string) {
    super(details, 'conflicting_options');
    this.name = 'ConflictingOptionsError';
    this.details = details;
  }
}
