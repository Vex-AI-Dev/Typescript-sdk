import type { VexResult } from './models';

export class VexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VexError';
  }
}

export class ConfigurationError extends VexError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class IngestionError extends VexError {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionError';
  }
}

export class VerificationError extends VexError {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class VexBlockError extends VexError {
  public readonly result: VexResult;
  constructor(result: VexResult) {
    super(`Output blocked (confidence=${result.confidence})`);
    this.name = 'VexBlockError';
    this.result = result;
  }
}
