import type { ExecutionEvent, ThresholdConfig } from '../models';
import { toSnakeCase, toCamelCase } from '../utils';
import { VerificationError } from '../errors';

export interface SyncTransportOptions {
  apiUrl: string;
  apiKey: string;
  timeoutMs?: number;
  correctionTimeoutMs?: number;
}

export interface VerifyOptions {
  thresholds?: ThresholdConfig;
  correction?: string;
  transparency?: string;
}

export interface VerifyResponse {
  executionId: string;
  confidence: number | null;
  action: string;
  output: unknown;
  corrections: Record<string, unknown>[] | null;
  checks: Record<string, unknown> | null;
  corrected: boolean;
  originalOutput: unknown | null;
  correctionAttempts: Record<string, unknown>[] | null;
}

export class SyncTransport {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly correctionTimeoutMs: number;

  constructor(opts: SyncTransportOptions) {
    this.apiUrl = opts.apiUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.correctionTimeoutMs = opts.correctionTimeoutMs ?? this.timeoutMs * 3;
  }

  async verify(
    event: ExecutionEvent,
    opts?: VerifyOptions,
  ): Promise<VerifyResponse> {
    const url = `${this.apiUrl}/v1/verify`;
    const payload = toSnakeCase(event) as Record<string, unknown>;
    if (!payload.metadata || typeof payload.metadata !== 'object')
      payload.metadata = {};
    const metadata = payload.metadata as Record<string, unknown>;

    if (opts?.thresholds) {
      metadata.thresholds = {
        pass_threshold: opts.thresholds.pass,
        flag_threshold: opts.thresholds.flag,
      };
    }
    const useCorrection = opts?.correction && opts.correction !== 'none';
    if (useCorrection) {
      metadata.correction = opts!.correction;
      metadata.transparency = opts?.transparency ?? 'opaque';
    }

    const timeout = useCorrection ? this.correctionTimeoutMs : this.timeoutMs;
    const maxRetries = 3;
    const baseDelay = 100;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vex-Key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) {
          throw new VerificationError(
            `Verification failed with status ${response.status}: ${await response.text()}`,
          );
        }
        const raw = await response.json();
        return toCamelCase(raw) as VerifyResponse;
      } catch (err) {
        if (err instanceof VerificationError) throw err;
        lastError = err;
        if (attempt < maxRetries - 1)
          await this.delay(baseDelay * 2 ** attempt);
      }
    }
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
