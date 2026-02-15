import type { ExecutionEvent } from '../models';
import { toSnakeCase } from '../utils';

export interface AsyncTransportOptions {
  apiUrl: string;
  apiKey: string;
  flushBatchSize?: number;
  timeoutMs?: number;
  maxBufferSize?: number;
}

export class AsyncTransport {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly flushBatchSize: number;
  private readonly timeoutMs: number;
  private readonly maxBufferSize: number;
  private buffer: ExecutionEvent[] = [];
  private droppedCount = 0;

  constructor(opts: AsyncTransportOptions) {
    this.apiUrl = opts.apiUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.flushBatchSize = opts.flushBatchSize ?? 50;
    this.timeoutMs = opts.timeoutMs ?? 2_000;
    this.maxBufferSize = opts.maxBufferSize ?? 10_000;
  }

  enqueue(event: ExecutionEvent): void {
    if (this.buffer.length >= this.maxBufferSize) {
      this.droppedCount++;
      if (this.droppedCount % 100 === 1) {
        console.warn(
          `[vex] Buffer full (${this.maxBufferSize} events), dropping event (total dropped: ${this.droppedCount})`,
        );
      }
      return;
    }
    this.buffer.push(event);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];
    const payload = batch.map((e) => toSnakeCase(e));
    const url = `${this.apiUrl}/v1/ingest/batch`;
    const maxRetries = 3;
    const baseDelay = 100;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vex-Key': this.apiKey,
          },
          body: JSON.stringify({ events: payload }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.ok) return;
        if (response.status < 500) {
          console.warn(
            `[vex] Client error ${response.status} on flush; dropping ${batch.length} events`,
          );
          return;
        }
        if (attempt < maxRetries - 1) await this.delay(baseDelay * 2 ** attempt);
      } catch {
        if (attempt < maxRetries - 1) await this.delay(baseDelay * 2 ** attempt);
      }
    }
    // All retries exhausted — return events to buffer
    const available = Math.max(0, this.maxBufferSize - this.buffer.length);
    const eventsToRetry = batch.slice(0, available);
    const dropped = batch.length - eventsToRetry.length;
    if (dropped > 0) {
      this.droppedCount += dropped;
      console.warn(`[vex] Dropped ${dropped} events due to buffer overflow on retry`);
    }
    this.buffer = [...eventsToRetry, ...this.buffer];
  }

  async close(): Promise<void> {
    await this.flush();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
