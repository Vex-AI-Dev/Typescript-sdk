import { resolveConfig, type VexConfig, type VexConfigInput } from './config';
import { ConfigurationError, VexBlockError } from './errors';
import type { VexResult } from './models';
import { AsyncTransport } from './transport/async';
import { SyncTransport } from './transport/sync';
import { TraceContext } from './trace';
import { Session } from './session';

export interface VexOptions {
  apiKey: string;
  config?: VexConfigInput;
}

export interface TraceOptions {
  agentId: string;
  task?: string;
  input?: unknown;
}

export class Vex {
  public readonly config: VexConfig;
  private readonly apiKey: string;
  private readonly asyncTransport: AsyncTransport;
  private readonly syncTransport: SyncTransport | null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(opts: VexOptions) {
    const key = opts.apiKey?.trim() ?? '';
    if (!key) throw new ConfigurationError('API key cannot be empty');
    if (key.length < 10) throw new ConfigurationError('API key appears invalid (too short)');
    this.apiKey = key;
    this.config = resolveConfig(opts.config);

    this.asyncTransport = new AsyncTransport({
      apiUrl: this.config.apiUrl,
      apiKey: this.apiKey,
      flushBatchSize: this.config.flushBatchSize,
      timeoutMs: this.config.timeoutMs,
      maxBufferSize: this.config.maxBufferSize,
    });

    this.syncTransport =
      this.config.mode === 'sync'
        ? new SyncTransport({
            apiUrl: this.config.apiUrl,
            apiKey: this.apiKey,
            timeoutMs: this.config.timeoutMs,
            correctionTimeoutMs: this.config.timeoutMs * 3,
          })
        : null;

    // Periodic flush
    this.flushTimer = setInterval(() => {
      this.asyncTransport.flush().catch(() => {});
    }, this.config.flushIntervalMs);
    if (
      this.flushTimer !== null &&
      typeof this.flushTimer === 'object' &&
      'unref' in this.flushTimer
    ) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  async trace(
    opts: TraceOptions,
    fn: (ctx: TraceContext) => Promise<void> | void,
  ): Promise<VexResult> {
    const ctx = new TraceContext({ agentId: opts.agentId, task: opts.task, input: opts.input });
    await fn(ctx);
    const event = ctx.buildEvent();
    return this.processEvent(event);
  }

  session(opts: {
    agentId: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Session {
    return new Session(this, opts.agentId, opts.sessionId, opts.metadata);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.asyncTransport.close();
  }

  /** @internal — used by Session */
  async _processTraceContext(ctx: TraceContext): Promise<VexResult> {
    const event = ctx.buildEvent();
    return this.processEvent(event);
  }

  private async processEvent(
    event: ReturnType<TraceContext['buildEvent']>,
  ): Promise<VexResult> {
    if (this.config.mode === 'sync' && this.syncTransport) {
      try {
        const response = await this.syncTransport.verify(event, {
          thresholds: this.config.threshold,
          correction: this.config.correction,
          transparency: this.config.transparency,
        });
        const result: VexResult = {
          output: response.output ?? event.output,
          confidence: response.confidence ?? null,
          action: (response.action as VexResult['action']) ?? 'pass',
          corrections: response.correctionAttempts ?? null,
          executionId: response.executionId ?? event.executionId,
          verification: response.checks ?? null,
          corrected: response.corrected ?? false,
          originalOutput: response.originalOutput ?? null,
        };
        if (result.action === 'block') throw new VexBlockError(result);
        if (result.action === 'flag') {
          console.warn(`[vex] Agent output flagged (confidence=${result.confidence})`);
        }
        return result;
      } catch (err) {
        if (err instanceof VexBlockError) throw err;
        console.warn('[vex] Sync verification failed; returning pass-through result');
        return this.passThroughResult(event);
      }
    }
    this.asyncTransport.enqueue(event);
    return this.passThroughResult(event);
  }

  private passThroughResult(event: { output: unknown; executionId: string }): VexResult {
    return {
      output: event.output,
      confidence: null,
      action: 'pass',
      corrections: null,
      executionId: event.executionId,
      verification: null,
      corrected: false,
      originalOutput: null,
    };
  }
}
