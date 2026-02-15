import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncTransport } from '../../src/transport/sync';
import { VerificationError } from '../../src/errors';
import type { ExecutionEvent } from '../../src/models';

function makeEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    executionId: 'exec-1',
    agentId: 'agent-1',
    input: 'hello',
    output: 'world',
    steps: [],
    metadata: {},
    timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const sampleServerResponse = {
  execution_id: 'exec-1',
  confidence: 0.95,
  action: 'pass',
  output: 'world',
  corrections: null,
  checks: { schema: { score: 1.0 } },
  corrected: false,
  original_output: null,
  correction_attempts: null,
};

function mockFetchJson(data: unknown = sampleServerResponse) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

describe('SyncTransport', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('POSTs event to /v1/verify and returns parsed camelCase response', async () => {
    const fetchMock = mockFetchJson();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    const result = await transport.verify(makeEvent());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/verify');
    expect(result.executionId).toBe('exec-1');
    expect(result.confidence).toBe(0.95);
    expect(result.corrected).toBe(false);
    expect(result.originalOutput).toBeNull();
  });

  it('converts event keys to snake_case in request body', async () => {
    const fetchMock = mockFetchJson();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    await transport.verify(makeEvent({ executionId: 'e1', agentId: 'a1' }));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.execution_id).toBe('e1');
    expect(body.agent_id).toBe('a1');
    expect(body.executionId).toBeUndefined();
  });

  it('includes thresholds in metadata when provided', async () => {
    const fetchMock = mockFetchJson();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    await transport.verify(makeEvent(), {
      thresholds: { pass: 0.8, flag: 0.5, block: 0.2 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.metadata.thresholds).toEqual({
      pass_threshold: 0.8,
      flag_threshold: 0.5,
    });
  });

  it('includes correction and transparency in metadata', async () => {
    const fetchMock = mockFetchJson();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    await transport.verify(makeEvent(), {
      correction: 'llm',
      transparency: 'visible',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.metadata.correction).toBe('llm');
    expect(body.metadata.transparency).toBe('visible');
  });

  it('uses longer timeout for correction requests', async () => {
    const fetchMock = mockFetchJson();
    vi.stubGlobal('fetch', fetchMock);

    // With short timeouts to verify correction uses correctionTimeoutMs
    const transport = new SyncTransport({
      apiUrl: 'https://api.test.com',
      apiKey: 'k',
      timeoutMs: 1_000,
      correctionTimeoutMs: 5_000,
    });

    // Should succeed without timeout since fetch resolves immediately
    const result = await transport.verify(makeEvent(), { correction: 'llm' });
    expect(result.executionId).toBe('exec-1');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws VerificationError on HTTP 4xx/5xx without retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('Unprocessable'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });

    await expect(transport.verify(makeEvent())).rejects.toThrow(VerificationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries on network errors with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(sampleServerResponse),
      });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    const result = await transport.verify(makeEvent());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.executionId).toBe('exec-1');
  });

  it('throws last network error after all retries exhausted', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('persistent failure'));
    vi.stubGlobal('fetch', fetchMock);

    const transport = new SyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });

    await expect(transport.verify(makeEvent())).rejects.toThrow('persistent failure');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
