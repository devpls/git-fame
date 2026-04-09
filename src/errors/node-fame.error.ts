export class NodeFameError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'NodeFameError';
    this.code = code;
  }
}
