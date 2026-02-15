import { describe, it, expect, vi, afterEach } from 'vitest';
import { Vex } from '../src/vex';
import { Session } from '../src/session';

const VALID_KEY = 'vex_test_key_1234567890';

function mockFetchResponse(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
    }),
  );
}

describe('Session', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('auto-generates a session ID (UUID length 36)', async () => {
    mockFetchResponse();
    const vex = new Vex({ apiKey: VALID_KEY });
    const session = vex.session({ agentId: 'a1' });
    expect(session.sessionId).toBeDefined();
    expect(session.sessionId.length).toBe(36);
    await vex.close();
  });

  it('accepts a custom session ID', async () => {
    mockFetchResponse();
    const vex = new Vex({ apiKey: VALID_KEY });
    const session = vex.session({ agentId: 'a1', sessionId: 'custom-sess' });
    expect(session.sessionId).toBe('custom-sess');
    await vex.close();
  });

  it('increments sequence after each trace', async () => {
    mockFetchResponse();
    const vex = new Vex({ apiKey: VALID_KEY });
    const session = vex.session({ agentId: 'a1' });
    expect(session.sequence).toBe(0);

    await session.trace({ input: 'q1' }, (ctx) => ctx.record('a1'));
    expect(session.sequence).toBe(1);

    await session.trace({ input: 'q2' }, (ctx) => ctx.record('a2'));
    expect(session.sequence).toBe(2);

    await session.trace({ input: 'q3' }, (ctx) => ctx.record('a3'));
    expect(session.sequence).toBe(3);
    await vex.close();
  });

  it('accumulates conversation history (verify sequence=3 after 3 traces)', async () => {
    mockFetchResponse();
    const vex = new Vex({ apiKey: VALID_KEY });
    const session = vex.session({ agentId: 'a1' });

    // Spy on _processTraceContext to capture the built events
    const processSpy = vi.spyOn(vex, '_processTraceContext');

    await session.trace({ input: 'q1', task: 'chat' }, (ctx) => ctx.record('a1'));
    await session.trace({ input: 'q2', task: 'chat' }, (ctx) => ctx.record('a2'));
    await session.trace({ input: 'q3', task: 'chat' }, (ctx) => ctx.record('a3'));

    expect(session.sequence).toBe(3);

    // The second call should have 1 history item, third should have 2
    const secondCtx = processSpy.mock.calls[1][0];
    const secondEvent = secondCtx.buildEvent();
    expect(secondEvent.conversationHistory).toHaveLength(1);
    expect(secondEvent.conversationHistory![0].sequenceNumber).toBe(0);

    const thirdCtx = processSpy.mock.calls[2][0];
    const thirdEvent = thirdCtx.buildEvent();
    expect(thirdEvent.conversationHistory).toHaveLength(2);
    expect(thirdEvent.conversationHistory![0].sequenceNumber).toBe(0);
    expect(thirdEvent.conversationHistory![1].sequenceNumber).toBe(1);

    await vex.close();
  });

  it('respects conversationWindowSize (config windowSize=2, make 3 traces)', async () => {
    mockFetchResponse();
    const vex = new Vex({ apiKey: VALID_KEY, config: { conversationWindowSize: 2 } });
    const session = vex.session({ agentId: 'a1' });

    const processSpy = vi.spyOn(vex, '_processTraceContext');

    await session.trace({ input: 'q1' }, (ctx) => ctx.record('a1'));
    await session.trace({ input: 'q2' }, (ctx) => ctx.record('a2'));
    await session.trace({ input: 'q3' }, (ctx) => ctx.record('a3'));

    // Fourth trace should only see last 2 history items (seq 1 and 2)
    await session.trace({ input: 'q4' }, (ctx) => ctx.record('a4'));

    const fourthCtx = processSpy.mock.calls[3][0];
    const fourthEvent = fourthCtx.buildEvent();
    expect(fourthEvent.conversationHistory).toHaveLength(2);
    expect(fourthEvent.conversationHistory![0].sequenceNumber).toBe(1);
    expect(fourthEvent.conversationHistory![1].sequenceNumber).toBe(2);

    await vex.close();
  });
});
