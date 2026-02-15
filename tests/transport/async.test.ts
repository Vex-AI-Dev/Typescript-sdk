import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncTransport } from '../../src/transport/async';
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

function mockFetchOk() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}

describe('AsyncTransport', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('enqueues events and flushes as batch POST', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'key-1' });
    transport.enqueue(makeEvent());
    transport.enqueue(makeEvent({ executionId: 'exec-2' }));
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test.com/v1/ingest/batch');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.events).toHaveLength(2);
  });

  it('sends X-Vex-Key header', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'my-secret' });
    transport.enqueue(makeEvent());
    await transport.flush();

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Vex-Key']).toBe('my-secret');
  });

  it('clears buffer after successful flush', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent());
    await transport.flush();
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does nothing on flush when buffer empty', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    await transport.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries on 5xx errors with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent());
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('drops events on 4xx errors without retry', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent());
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Client error 400'));

    // Buffer should be empty (events dropped)
    await transport.flush();
    expect(fetchMock).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it('returns events to buffer after all retries exhausted', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent());
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Events should be back in buffer — flushing again should trigger another fetch
    const fetchMock2 = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock2);
    await transport.flush();
    expect(fetchMock2).toHaveBeenCalledOnce();
  });

  it('drops events when buffer exceeds maxBufferSize', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const transport = new AsyncTransport({
      apiUrl: 'https://api.test.com',
      apiKey: 'k',
      maxBufferSize: 3,
    });

    transport.enqueue(makeEvent({ executionId: 'e1' }));
    transport.enqueue(makeEvent({ executionId: 'e2' }));
    transport.enqueue(makeEvent({ executionId: 'e3' }));
    transport.enqueue(makeEvent({ executionId: 'e4' })); // should be dropped

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Buffer full'));

    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);
    await transport.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(3);

    warnSpy.mockRestore();
  });

  it('converts event keys to snake_case in payload', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent({ executionId: 'e1', agentId: 'a1' }));
    await transport.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const event = body.events[0];
    expect(event.execution_id).toBe('e1');
    expect(event.agent_id).toBe('a1');
    expect(event.executionId).toBeUndefined();
  });

  it('flushes remaining events on close', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const transport = new AsyncTransport({ apiUrl: 'https://api.test.com', apiKey: 'k' });
    transport.enqueue(makeEvent());
    await transport.close();

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
