import { NodeFameError } from './node-fame.error.js';

export class AbortError extends NodeFameError {
  constructor(message = 'analysis aborted') {
    super(message, 'aborted');
    this.name = 'AbortError';
  }
}
