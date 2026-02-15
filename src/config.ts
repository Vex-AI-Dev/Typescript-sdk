import type { ThresholdConfig } from './models';
import { ConfigurationError } from './errors';

export interface VexConfig {
  apiKey?: string;
  apiUrl: string;
  mode: 'sync' | 'async';
  correction: 'none' | 'auto';
  transparency: 'opaque' | 'transparent';
  timeoutMs: number;
  flushIntervalMs: number;
  flushBatchSize: number;
  conversationWindowSize: number;
  maxBufferSize: number;
  threshold: ThresholdConfig;
  logEventIds: boolean;
}

export type VexConfigInput = Partial<Omit<VexConfig, 'threshold'>> & {
  threshold?: Partial<ThresholdConfig>;
};

const DEFAULTS: VexConfig = {
  mode: 'async',
  correction: 'none',
  transparency: 'opaque',
  apiUrl: 'https://api.tryvex.dev',
  timeoutMs: 10000,
  flushIntervalMs: 1000,
  flushBatchSize: 50,
  conversationWindowSize: 10,
  maxBufferSize: 10000,
  threshold: { pass: 0.8, flag: 0.5, block: 0.3 },
  logEventIds: false,
};

export function validateThresholds(t: ThresholdConfig): void {
  if (!(t.block < t.flag && t.flag < t.pass)) {
    throw new ConfigurationError(
      `Invalid thresholds: block (${t.block}) < flag (${t.flag}) < pass (${t.pass}) must hold`,
    );
  }
}

export function resolveConfig(input?: VexConfigInput): VexConfig {
  const threshold: ThresholdConfig = {
    ...DEFAULTS.threshold,
    ...input?.threshold,
  };
  validateThresholds(threshold);

  return {
    ...DEFAULTS,
    ...input,
    threshold,
  };
}
