import { describe, it, expect } from 'vitest';
import { resolveConfig, validateThresholds } from '../src/config';
import { ConfigurationError } from '../src/errors';

describe('validateThresholds', () => {
  it('accepts valid thresholds', () => {
    expect(() => validateThresholds({ pass: 0.8, flag: 0.5, block: 0.3 })).not.toThrow();
  });

  it('throws if block >= flag', () => {
    expect(() => validateThresholds({ pass: 0.8, flag: 0.5, block: 0.5 })).toThrow(
      ConfigurationError,
    );
  });

  it('throws if flag >= pass', () => {
    expect(() => validateThresholds({ pass: 0.5, flag: 0.5, block: 0.3 })).toThrow(
      ConfigurationError,
    );
  });
});

describe('resolveConfig', () => {
  it('returns all defaults when called with no input', () => {
    const cfg = resolveConfig();
    expect(cfg.mode).toBe('async');
    expect(cfg.correction).toBe('none');
    expect(cfg.transparency).toBe('opaque');
    expect(cfg.apiUrl).toBe('https://api.tryvex.dev');
    expect(cfg.timeoutMs).toBe(10000);
    expect(cfg.flushIntervalMs).toBe(1000);
    expect(cfg.flushBatchSize).toBe(50);
    expect(cfg.conversationWindowSize).toBe(10);
    expect(cfg.maxBufferSize).toBe(10000);
    expect(cfg.threshold).toEqual({ pass: 0.8, flag: 0.5, block: 0.3 });
    expect(cfg.logEventIds).toBe(false);
  });

  it('merges partial input with defaults', () => {
    const cfg = resolveConfig({ mode: 'sync', timeoutMs: 5000 });
    expect(cfg.mode).toBe('sync');
    expect(cfg.timeoutMs).toBe(5000);
    expect(cfg.apiUrl).toBe('https://api.tryvex.dev');
  });

  it('merges partial threshold with defaults', () => {
    const cfg = resolveConfig({ threshold: { pass: 0.9 } });
    expect(cfg.threshold).toEqual({ pass: 0.9, flag: 0.5, block: 0.3 });
  });

  it('throws on invalid thresholds', () => {
    expect(() => resolveConfig({ threshold: { pass: 0.2 } })).toThrow(ConfigurationError);
  });

  it('reads apiKey from input', () => {
    const cfg = resolveConfig({ apiKey: 'sk-test' });
    expect(cfg.apiKey).toBe('sk-test');
  });
});
