import { describe, it, expect } from 'vitest';
import {
  VexError,
  ConfigurationError,
  IngestionError,
  VerificationError,
  VexBlockError,
} from '../src/errors';
import type { VexResult } from '../src/models';

describe('VexError', () => {
  it('is instanceof Error', () => {
    const err = new VexError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VexError');
    expect(err.message).toBe('test');
  });
});

describe('ConfigurationError', () => {
  it('is instanceof VexError and Error', () => {
    const err = new ConfigurationError('bad config');
    expect(err).toBeInstanceOf(VexError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConfigurationError');
  });
});

describe('IngestionError', () => {
  it('is instanceof VexError and Error', () => {
    const err = new IngestionError('ingest fail');
    expect(err).toBeInstanceOf(VexError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('IngestionError');
  });
});

describe('VerificationError', () => {
  it('is instanceof VexError and Error', () => {
    const err = new VerificationError('verify fail');
    expect(err).toBeInstanceOf(VexError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VerificationError');
  });
});

describe('VexBlockError', () => {
  it('carries result and formats message', () => {
    const result: VexResult = {
      executionId: 'abc',
      action: 'block',
      confidence: 0.25,
      output: 'blocked output',
      corrections: null,
      verification: {},
      corrected: false,
      originalOutput: null,
    };
    const err = new VexBlockError(result);
    expect(err).toBeInstanceOf(VexError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VexBlockError');
    expect(err.result).toBe(result);
    expect(err.message).toBe('Output blocked (confidence=0.25)');
  });
});
